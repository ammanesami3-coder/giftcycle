import express from "express";
import dotenv from "dotenv";
import Stripe from "stripe";
import pool from "../config/db.js";
import shippoFactory from "shippo";

dotenv.config();

const router = express.Router();
const CLIENT_BASE_URL =
  process.env.CLIENT_URL ||
  process.env.FRONTEND_URL ||
  "http://localhost:3000";

const shippo = shippoFactory(process.env.SHIPPO_API_KEY);

// اختيار مفتاح Stripe
const stripeSecretKey =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;

if (!stripeSecretKey) {
  console.warn("⚠️ Stripe secret key is not set. Sale payments will not work.");
}

const stripe = new Stripe(stripeSecretKey);

// دالة مساعدة للإشعارات
async function createNotification(
  user_id,
  type,
  reference_id,
  message,
  link = null
) {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, reference_id, message, link)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user_id, type, reference_id, message, link]
    );
    return result.rows[0];
  } catch (err) {
    console.error("⚠️ Failed to create notification:", err.message);
    return null;
  }
}

// دالة التحقق من أن الـ user هو المشتري (غير مستخدمة حاليًا لكن نتركها)
async function getSaleOfferForBuyer(offerId, buyerId) {
  const offerRes = await pool.query("SELECT * FROM offers WHERE id = $1", [
    offerId,
  ]);
  if (offerRes.rows.length === 0) {
    return { error: "Offer not found" };
  }

  const offer = offerRes.rows[0];

  if (offer.offer_type !== "buy") {
    return { error: "This offer is not a sale offer." };
  }

  if (offer.sender_id !== buyerId) {
    return { error: "You are not the buyer for this offer." };
  }

  if (offer.status !== "accepted") {
    return { error: "Offer must be accepted before payment." };
  }

  if (offer.sale_status !== "awaiting_buyer_payment") {
    return { error: "Sale is not in awaiting_buyer_payment state." };
  }

  return { offer };
}

/* ============================================================
   0) إدخال عنوان شحن المشتري
   POST /api/sale/:offerId/buyer-address
   body: { user_id, fullname, address, address2, city, state, zip }
   ============================================================ */
router.post("/:offerId/buyer-address", async (req, res) => {
  const { offerId } = req.params;
  const { user_id, fullname, address, address2, city, state, zip } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  if (!fullname || !address || !city || !state || !zip) {
    return res.status(400).json({
      error: "missing_fields",
      message: "All required address fields must be provided.",
    });
  }

  try {
    // 1) جلب العرض
    const offerRes = await pool.query("SELECT * FROM offers WHERE id = $1", [
      offerId,
    ]);
    if (offerRes.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const offer = offerRes.rows[0];

    // 2) يجب أن يكون العرض من نوع بيع
    if (offer.offer_type !== "buy") {
      return res.status(400).json({ error: "This is not a sale offer." });
    }

    // 3) السماح فقط للبائع أو المشتري
    const isBuyer = Number(user_id) === offer.sender_id;
    const isSeller = Number(user_id) === offer.owner_id;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        error: "Only the buyer or seller can add address.",
      });
    }

    // 4) التأكد من حالة البيع
    if (
      !["awaiting_buyer_payment", "awaiting_shipping_selection"].includes(
        offer.sale_status
      )
    ) {
      return res.status(400).json({
        error: "invalid_state",
        message: "Cannot add address in current sale status.",
      });
    }

    // 5) تحديث عنوان هذا المستخدم (سواء كان بائع أو مشتري)
    await pool.query(
      `UPDATE users SET
         shipping_fullname = $1,
         shipping_address = $2,
         shipping_address2 = $3,
         shipping_city = $4,
         shipping_state = $5,
         shipping_zip = $6
       WHERE id = $7`,
      [fullname, address, address2 || null, city, state, zip, user_id]
    );

    // 6) تحديث حالة البيع فقط عندما يكون الذي يحدّث العنوان هو "المشتري"
    let newSaleStatus = offer.sale_status;
    if (isBuyer && offer.sale_status === "awaiting_buyer_payment") {
      newSaleStatus = "awaiting_shipping_selection";
      await pool.query(
        `UPDATE offers SET sale_status = $1 WHERE id = $2`,
        [newSaleStatus, offerId]
      );
    }

    return res.json({
      success: true,
      message: "Address saved successfully.",
      sale_status: newSaleStatus,
      role: isBuyer ? "buyer" : "seller",
    });
  } catch (err) {
    console.error("❌ Error in /sale/:offerId/buyer-address:", err.message);
    return res.status(500).json({ error: "Failed to save buyer address." });
  }
});

/* ============================================================
   0-bis) إدخال عنوان شحن البائع
   POST /api/sale/:offerId/seller-address
   ============================================================ */
router.post("/:offerId/seller-address", async (req, res) => {
  const { offerId } = req.params;
  const { user_id, fullname, address, address2, city, state, zip } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  if (!fullname || !address || !city || !state || !zip) {
    return res.status(400).json({
      error: "missing_fields",
      message: "All required address fields must be provided.",
    });
  }

  try {
    const offerRes = await pool.query("SELECT * FROM offers WHERE id = $1", [
      offerId,
    ]);
    if (offerRes.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const offer = offerRes.rows[0];

    if (offer.offer_type !== "buy") {
      return res.status(400).json({ error: "This is not a sale offer." });
    }

    if (offer.owner_id !== Number(user_id)) {
      return res.status(403).json({
        error: "Only the seller (gift owner) can add this address.",
      });
    }

    await pool.query(
      `UPDATE users SET
         shipping_fullname = $1,
         shipping_address = $2,
         shipping_address2 = $3,
         shipping_city = $4,
         shipping_state = $5,
         shipping_zip = $6
       WHERE id = $7`,
      [fullname, address, address2 || null, city, state, zip, user_id]
    );

    return res.json({
      success: true,
      message: "Seller address saved successfully.",
      sale_status: offer.sale_status,
    });
  } catch (err) {
    console.error("❌ Error in /sale/:offerId/seller-address:", err.message);
    return res.status(500).json({ error: "Failed to save seller address." });
  }
});

/* ============================================================
   1.5) جلب أسعار الشحن من Shippo
   GET /api/sale/:offerId/shipping-rates
   ============================================================ */
router.get("/:offerId/shipping-rates", async (req, res) => {
  const { offerId } = req.params;
  const user_id = req.query.user_id;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    // جلب العرض
    const offerRes = await pool.query("SELECT * FROM offers WHERE id = $1", [
      offerId,
    ]);
    if (offerRes.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const offer = offerRes.rows[0];

    if (offer.offer_type !== "buy") {
      return res.status(400).json({ error: "This is not a sale offer." });
    }

    // فقط المشتري يمكنه طلب الأسعار
    if (offer.sender_id !== Number(user_id)) {
      return res.status(403).json({
        error: "Only the buyer can request shipping rates.",
      });
    }

    // الحالة يجب أن تسمح بالحصول على الأسعار
    if (offer.sale_status !== "awaiting_shipping_selection") {
      return res.status(400).json({
        error: "Sale is not in a state that allows fetching shipping rates.",
        sale_status: offer.sale_status,
      });
    }

    // 1) عناوين البائع والمشتري
    const seller = await pool.query(
      `SELECT shipping_fullname, shipping_address, shipping_address2,
              shipping_city, shipping_state, shipping_zip, shipping_country
       FROM users WHERE id = $1`,
      [offer.owner_id]
    );

    const buyer = await pool.query(
      `SELECT shipping_fullname, shipping_address, shipping_address2,
              shipping_city, shipping_state, shipping_zip, shipping_country
       FROM users WHERE id = $1`,
      [offer.sender_id]
    );

    if (!seller.rows[0] || !buyer.rows[0]) {
      return res.status(400).json({
        error: "missing_addresses",
        message: "Buyer or seller does not have a shipping address.",
      });
    }

    const sellerAddress = seller.rows[0];
    const buyerAddress = buyer.rows[0];

    // 2) بيانات الهدية (الوزن والأبعاد)
    const giftRes = await pool.query(
      "SELECT parcel_weight_kg, parcel_length, parcel_width, parcel_height FROM gifts WHERE id = $1",
      [offer.gift_id]
    );

    if (giftRes.rows.length === 0) {
      return res.status(404).json({ error: "Gift not found" });
    }

    const gift = giftRes.rows[0];

    const weightKg =
      gift.parcel_weight_kg !== null && gift.parcel_weight_kg !== undefined
        ? Number(gift.parcel_weight_kg)
        : NaN;

    if (!weightKg || isNaN(weightKg) || weightKg <= 0) {
      return res.status(400).json({
        error: "missing_weight",
        message: "Gift does not have a valid parcel_weight_kg assigned.",
      });
    }

    // 3) Parcel
    const parcel = {
      length: gift.parcel_length || 6,
      width: gift.parcel_width || 6,
      height: gift.parcel_height || 4,
      distance_unit: "in",
      weight: weightKg,
      mass_unit: "kg",
    };

    // 4) عناوين Shippo
    const fromAddress = {
      name: sellerAddress.shipping_fullname,
      street1: sellerAddress.shipping_address,
      street2: sellerAddress.shipping_address2 || "",
      city: sellerAddress.shipping_city,
      state: sellerAddress.shipping_state,
      zip: sellerAddress.shipping_zip,
      country: sellerAddress.shipping_country || "US",
    };

    const toAddress = {
      name: buyerAddress.shipping_fullname,
      street1: buyerAddress.shipping_address,
      street2: buyerAddress.shipping_address2 || "",
      city: buyerAddress.shipping_city,
      state: buyerAddress.shipping_state,
      zip: buyerAddress.shipping_zip,
      country: buyerAddress.shipping_country || "US",
    };

    // 5) طلب الأسعار من Shippo
    const shippoDyn = (await import("shippo")).default(
      process.env.SHIPPO_API_KEY
    );

    const rateReq = await shippoDyn.shipment.create({
      address_from: fromAddress,
      address_to: toAddress,
      parcels: [parcel],
      async: false,
    });

    if (!rateReq.rates || rateReq.rates.length === 0) {
      return res.status(400).json({ error: "No shipping rates returned" });
    }

    const rates = rateReq.rates.map((r) => ({
      object_id: r.object_id,
      provider: r.provider,
      service: r.servicelevel?.name || "",
      servicelevel_name: r.servicelevel?.name || "",
      amount: r.amount,
      currency: r.currency,
      est_days: r.estimated_days,
    }));

    return res.json({
      success: true,
      sale_status: "awaiting_shipping_selection",
      rates,
    });
  } catch (err) {
    console.error("❌ Error in GET /shipping-rates:", err);
    return res.status(500).json({ error: "Failed to fetch shipping rates." });
  }
});

/* ============================================================
   2) اختيار المشتري لسعر الشحن
   POST /api/sale/:offerId/select-rate
   ============================================================ */
router.post("/:offerId/select-rate", async (req, res) => {
  const { offerId } = req.params;
  const { user_id, rate_id, amount } = req.body;

  const amountNumber = Number(amount);

  if (!user_id || !rate_id || isNaN(amountNumber)) {
    return res.status(400).json({
      error: "missing_fields",
      message: "user_id, rate_id and a valid numeric amount are required.",
    });
  }

  try {
    // 1) جلب العرض
    const offerRes = await pool.query("SELECT * FROM offers WHERE id = $1", [
      offerId,
    ]);

    if (offerRes.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const offer = offerRes.rows[0];

    // 2) التحقق أن العرض بيع
    if (offer.offer_type !== "buy") {
      return res.status(400).json({ error: "This is not a sale offer." });
    }

    // 3) فقط المشتري يمكنه اختيار السعر
    if (offer.sender_id !== Number(user_id)) {
      return res.status(403).json({
        error: "Only the buyer can select a shipping rate.",
      });
    }

    // 4) الحالة الصحيحة لاختيار شركة الشحن
    if (offer.sale_status !== "awaiting_shipping_selection") {
      return res.status(400).json({
        error: "Sale status does not allow selecting rate.",
        sale_status: offer.sale_status,
      });
    }

    // 5) سعر الشحن من Shippo ⇒ cents
    const shippingCostCents = Math.round(amountNumber * 100);

    // 6) عمولة المنصة على الشحن (1.5$ = 150 cents)
    const platformFeeCents = 150;

    // 7) سعر الهدية من gifts.price
    const giftRes = await pool.query("SELECT price FROM gifts WHERE id = $1", [
      offer.gift_id,
    ]);

    if (giftRes.rows.length === 0) {
      return res.status(404).json({ error: "Gift not found" });
    }

    const giftRow = giftRes.rows[0];

    const rawGiftPrice =
      giftRow.price != null ? Number(giftRow.price) : Number(offer.price || 0);

    const giftPriceCents = Math.round(rawGiftPrice * 100);

    // 8) المجموع النهائي (للواجهة فقط)
    const totalCents = giftPriceCents + shippingCostCents + platformFeeCents;

    const updateRes = await pool.query(
      `UPDATE offers
       SET selected_rate_id    = $1,
           shipping_cost_cents = $2,
           platform_fee_cents  = $3,
           sale_status         = 'awaiting_buyer_payment'
       WHERE id = $4
       RETURNING id, sale_status,
                 selected_rate_id,
                 shipping_cost_cents,
                 platform_fee_cents`,
      [rate_id, shippingCostCents, platformFeeCents, offerId]
    );

    const updatedOffer = updateRes.rows[0];

    return res.json({
      success: true,
      message:
        "Shipping option selected successfully. You can now proceed to payment.",
      sale_status: updatedOffer.sale_status,
      offer: updatedOffer,
      summary: {
        gift_price_cents: giftPriceCents,
        shipping_cost_cents: shippingCostCents,
        platform_fee_cents: platformFeeCents,
        total_cents: totalCents,
      },
    });
  } catch (err) {
    console.error("❌ Error in POST /sale/:offerId/select-rate:", err);
    return res.status(500).json({ error: "Failed to select shipping rate." });
  }
});

/* ============================================================
   3) إنشاء جلسة الدفع لعملية البيع
   POST /api/sale/:offerId/checkout
   ============================================================ */
router.post("/:offerId/checkout", async (req, res) => {
  const { offerId } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    // 1) جلب العرض
    const offerRes = await pool.query("SELECT * FROM offers WHERE id = $1", [
      offerId,
    ]);
    if (offerRes.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const offer = offerRes.rows[0];

    // 2) التحقق أن العرض بيع
    if (offer.offer_type !== "buy") {
      return res.status(400).json({ error: "This is not a sale offer." });
    }

    // 3) فقط المشتري يمكنه الدفع
    if (offer.sender_id !== Number(user_id)) {
      return res.status(403).json({
        error: "Only the buyer can pay for this sale.",
      });
    }

    // 4) الحالة يجب أن تكون جاهزة للدفع
    if (offer.sale_status !== "awaiting_buyer_payment") {
      return res.status(400).json({
        error: "Sale is not in awaiting_buyer_payment state.",
        sale_status: offer.sale_status,
      });
    }

    // 5) يجب أن يكون قد تم اختيار سعر شحن
    if (
      !offer.selected_rate_id ||
      offer.shipping_cost_cents == null ||
      offer.platform_fee_cents == null
    ) {
      return res.status(400).json({
        error: "missing_shipping_rate",
        message:
          "Shipping rate has not been selected yet. Please choose a shipping option first.",
      });
    }

    const shippingCostCents = Number(offer.shipping_cost_cents) || 0;
    const platformFeeCents = Number(offer.platform_fee_cents) || 0;

    // 6) جلب بيانات الهدية لحساب السعر
    const giftRes = await pool.query(
      "SELECT title, price FROM gifts WHERE id = $1",
      [offer.gift_id]
    );

    if (giftRes.rows.length === 0) {
      return res.status(404).json({ error: "Gift not found" });
    }

    const gift = giftRes.rows[0];

    const rawGiftPrice =
      gift.price != null ? Number(gift.price) : Number(offer.price || 0);
    const giftPriceCents = Math.round(rawGiftPrice * 100);

    // 7) المبلغ النهائي (للـ metadata فقط)
    const totalCents =
      giftPriceCents + shippingCostCents + platformFeeCents;

    // جلب إيميل المشتري من users
    const buyerRes = await pool.query(
      "SELECT email FROM users WHERE id = $1",
      [offer.sender_id]
    );

    if (buyerRes.rows.length === 0) {
      return res.status(404).json({ error: "Buyer not found" });
    }

    const buyer = buyerRes.rows[0];

    // 8) إنشاء جلسة الدفع في Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: process.env.STRIPE_CURRENCY || "usd",
      customer_email: buyer.email,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: process.env.STRIPE_CURRENCY || "usd",
            product_data: {
              name: gift.title,
              description: "Gift price",
            },
            unit_amount: giftPriceCents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: process.env.STRIPE_CURRENCY || "usd",
            product_data: {
              name: "Shipping cost",
            },
            unit_amount: shippingCostCents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: process.env.STRIPE_CURRENCY || "usd",
            product_data: {
              name: "GiftCycle shipping service fee",
            },
            unit_amount: platformFeeCents,
          },
          quantity: 1,
        },
      ],
      // مهم جداً: نرسل session_id + flow حتى يلتقطها useEffect في الواجهة
      success_url: `${CLIENT_BASE_URL}/offer/${offerId}/chat?flow=sale&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_BASE_URL}/offer/${offerId}/chat?flow=sale&canceled=1`,

      metadata: {
        type: "sale_payment",
        offer_id: String(offerId),
        buyer_id: String(user_id),
        gift_price_cents: String(giftPriceCents),
        shipping_cost_cents: String(shippingCostCents),
        platform_fee_cents: String(platformFeeCents),
        total_cents: String(totalCents),
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Error in POST /sale/:offerId/checkout:", err);
    return res
      .status(500)
      .json({ error: "Failed to create sale checkout session." });
  }
});

/* ============================================================
   3) تأكيد دفع المشتري بعد العودة من Stripe
   POST /api/sale/:offerId/confirm-payment
   ============================================================ */
router.post("/:offerId/confirm-payment", async (req, res) => {
  const { offerId } = req.params;
  const { session_id, user_id } = req.body;

  if (!session_id || !user_id) {
    return res.status(400).json({
      error: "missing_fields",
      message: "session_id and user_id are required.",
    });
  }

  try {
    // 1) جلب العرض
    const offerRes = await pool.query("SELECT * FROM offers WHERE id = $1", [
      offerId,
    ]);

    if (offerRes.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const offer = offerRes.rows[0];

    // تأكد أنه عرض بيع
    if (offer.offer_type !== "buy") {
      return res.status(400).json({ error: "This is not a sale offer." });
    }

    // تأكد أن المستخدم هو المشتري
    if (offer.sender_id !== Number(user_id)) {
      return res.status(403).json({
        error: "Only the buyer can confirm this payment.",
      });
    }

    // الحالة يجب أن تكون في انتظار دفع المشتري
    if (offer.sale_status !== "awaiting_buyer_payment") {
      return res.status(400).json({
        error: "invalid_state",
        message: "Sale is not awaiting buyer payment.",
        sale_status: offer.sale_status,
      });
    }

    // 2) جلب الـ session من Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session) {
      return res.status(400).json({
        error: "session_not_found",
        message: "Stripe session not found.",
      });
    }

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        error: "payment_not_paid",
        message: "Payment is not marked as paid in Stripe.",
        stripe_status: session.payment_status,
      });
    }

    // 3) تحديث حالة العرض إلى buyer_paid
    await pool.query(
      `UPDATE offers
       SET sale_status = 'buyer_paid',
           stripe_session_id = $1,
           stripe_payment_intent = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [session.id, session.payment_intent, offerId]
    );

    const updatedOfferRes = await pool.query(
      "SELECT * FROM offers WHERE id = $1",
      [offerId]
    );
    const updatedOffer = updatedOfferRes.rows[0];

    // 4) إنشاء إشعارات للطرفين + بثها عبر socket
    const buyerNote = await createNotification(
      updatedOffer.sender_id,
      "sale_payment_success_buyer",
      updatedOffer.id,
      "Your payment was successful. Waiting for the seller to ship your gift.",
      `/offer/${updatedOffer.id}/chat`
    );

    const sellerNote = await createNotification(
      updatedOffer.owner_id,
      "sale_payment_success_seller",
      updatedOffer.id,
      "The buyer has paid. Please generate a shipping label and ship the gift.",
      `/offer/${updatedOffer.id}/chat`
    );

    if (buyerNote && req.sendLiveNotification) {
      req.sendLiveNotification(updatedOffer.sender_id, buyerNote);
    }
    if (sellerNote && req.sendLiveNotification) {
      req.sendLiveNotification(updatedOffer.owner_id, sellerNote);
    }

    if (req.io) {
      req.io.emit("offerUpdated", { offerId: updatedOffer.id });
    }

    return res.json({
      success: true,
      sale_status: "buyer_paid",
      message:
        "Payment confirmed. Waiting for the seller to generate a label and ship your gift.",
    });
  } catch (err) {
    console.error("❌ Error in POST /sale/:offerId/confirm-payment:", err);
    return res.status(500).json({
      error: "Failed to confirm payment.",
    });
  }
});

/* ============================================================
   3-bis) جلب بيانات شحنة البيع (label + tracking)
   GET /api/sale/:offerId/shipment
   ============================================================ */
router.get("/:offerId/shipment", async (req, res) => {
  const { offerId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, offer_id, seller_id, buyer_id,
              carrier, tracking_number, label_url, shipping_status,
              created_at, updated_at
       FROM shipments
       WHERE offer_id = $1`,
      [offerId]
    );

    if (result.rows.length === 0) {
      return res.json({ shipment: null });
    }

    return res.json({ shipment: result.rows[0] });
  } catch (err) {
    console.error("❌ Error in GET /sale/:offerId/shipment:", err.message);
    return res
      .status(500)
      .json({ error: "Failed to load sale shipment information." });
  }
});

/* ============================================================
   3-ter) توليد Shipping Label للبائع بعد الدفع
   POST /api/sale/:offerId/create-label
   body: { user_id }
   ============================================================ */
router.post("/:offerId/create-label", async (req, res) => {
  const { offerId } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    const offerRes = await pool.query("SELECT * FROM offers WHERE id = $1", [
      offerId,
    ]);
    if (offerRes.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const offer = offerRes.rows[0];

    if (offer.offer_type !== "buy") {
      return res.status(400).json({ error: "This is not a sale offer." });
    }

    // فقط البائع
    if (offer.owner_id !== Number(user_id)) {
      return res.status(403).json({
        error: "Only the seller can create a shipping label for this sale.",
      });
    }

    // يجب أن يكون المشتري قد دفع (أو تم الشحن بالفعل)
    if (offer.sale_status !== "buyer_paid" && offer.sale_status !== "shipped") {
      return res.status(400).json({
        error: "invalid_state",
        message:
          "You can create a shipping label only after the buyer has paid.",
        sale_status: offer.sale_status,
      });
    }

    if (!offer.selected_rate_id) {
      return res.status(400).json({
        error: "missing_rate",
        message: "Shipping rate must be selected before creating a label.",
      });
    }

    // هل يوجد label موجود مسبقًا؟
    const existingShipmentRes = await pool.query(
      "SELECT * FROM shipments WHERE offer_id = $1",
      [offerId]
    );
    const existingShipment = existingShipmentRes.rows[0] || null;

    if (
      existingShipment &&
      existingShipment.label_url &&
      existingShipment.tracking_number
    ) {
      return res.json({
        success: true,
        message: "Shipping label already exists.",
        sale_status: offer.sale_status,
        shipment: existingShipment,
      });
    }

    // إنشاء Transaction في Shippo باستخدام selected_rate_id
        // إنشاء Transaction في Shippo باستخدام selected_rate_id
    let transaction;
    try {
      transaction = await shippo.transaction.create({
        rate: offer.selected_rate_id,
        label_file_type: "PDF",
        async: false,              // ← مهم جداً: نطلب معالجة متزامنة
      });

      console.log("🔵 Shippo transaction result:", {
        status: transaction.status,
        messages: transaction.messages,
        label_url: transaction.label_url,
        tracking_number: transaction.tracking_number,
      });
    } catch (err) {
      console.error("❌ Shippo Transaction Error:", err);
      return res
        .status(500)
        .json({ error: "Failed to create shipping label." });
    }

    if (transaction.status !== "SUCCESS") {
      console.error("❌ Shippo Transaction Failed (status != SUCCESS):", {
        status: transaction.status,
        messages: transaction.messages,
      });
      return res.status(500).json({
        error: "shippo_transaction_failed",
        status: transaction.status,
        messages: transaction.messages,
      });
    }

    const labelUrl = transaction.label_url;
    const trackingNumber = transaction.tracking_number;


    let shipment;

    if (existingShipment) {
      const upd = await pool.query(
        `UPDATE shipments
         SET seller_id = $1,
             buyer_id = $2,
             carrier = $3,
             tracking_number = $4,
             label_url = $5,
             shipping_status = 'label_created',
             updated_at = NOW()
         WHERE offer_id = $6
         RETURNING *`,
        [
          offer.owner_id,
          offer.sender_id,
          transaction.provider,
          trackingNumber,
          labelUrl,
          offerId,
        ]
      );
      shipment = upd.rows[0];
    } else {
      const ins = await pool.query(
        `INSERT INTO shipments 
           (offer_id, seller_id, buyer_id, carrier, tracking_number, label_url, shipping_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'label_created')
         RETURNING *`,
        [
          offerId,
          offer.owner_id,
          offer.sender_id,
          transaction.provider,
          trackingNumber,
          labelUrl,
        ]
      );
      shipment = ins.rows[0];
    }

    // إشعار البائع
    const labelNoteSeller = await createNotification(
      offer.owner_id,
      "sale_label_ready",
      offer.id,
      "A shipping label is ready for your order. Click to download and ship the package.",
      `/offer/${offer.id}/chat`
    );

    if (labelNoteSeller && req.sendLiveNotification) {
      req.sendLiveNotification(offer.owner_id, labelNoteSeller);
    }

    // إشعار المشتري بأن رقم التتبع متاح
    const labelNoteBuyer = await createNotification(
      offer.sender_id,
      "sale_label_created_buyer",
      offer.id,
      "The seller has created a shipping label for your order. Tracking details are now available.",
      `/offer/${offer.id}/chat`
    );

    if (labelNoteBuyer && req.sendLiveNotification) {
      req.sendLiveNotification(offer.sender_id, labelNoteBuyer);
    }

    if (req.io) {
      req.io.emit("offerUpdated", { offerId: offer.id });
    }

    return res.json({
      success: true,
      message: "Shipping label created successfully.",
      sale_status: offer.sale_status,
      shipment,
    });
  } catch (err) {
    console.error("❌ Error in POST /sale/:offerId/create-label:", err.message);
    return res.status(500).json({
      error: "Failed to create shipping label.",
    });
  }
});

/* ============================================================
   2) /sale/confirm  (منطق قديم – نتركه كما هو لكنه غير مستخدم الآن)
   ============================================================ */
router.post("/confirm", async (req, res) => {
  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ error: "session_id is required" });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ error: "Payment is not completed." });
    }

    const { offer_id, buyer_id, payment_id, type } = session.metadata || {};

    if (!offer_id || !buyer_id || !payment_id || type !== "sale_payment") {
      return res
        .status(400)
        .json({ error: "Invalid metadata in Stripe session." });
    }

    await pool.query(
      `UPDATE payments
       SET status = 'succeeded',
           stripe_payment_intent_id = $1
       WHERE id = $2`,
      [session.payment_intent, payment_id]
    );

    const offerDetails = await pool.query(
      `SELECT selected_rate_id, owner_id, sender_id, gift_id
       FROM offers WHERE id = $1`,
      [offer_id]
    );

    const od = offerDetails.rows[0];

    if (!od.selected_rate_id) {
      return res.status(400).json({
        error: "missing_rate",
        message: "Shipping rate must be selected before payment.",
      });
    }

    let transaction;
    try {
      transaction = await shippo.transaction.create({
        rate: od.selected_rate_id,
        label_file_type: "PDF",
      });
    } catch (err) {
      console.error("❌ Shippo Transaction Error:", err);
      return res.status(500).json({ error: "Failed to create shipping label." });
    }

    if (transaction.status !== "SUCCESS") {
      console.error("❌ Shippo Transaction Failed:", transaction.messages);
      return res.status(500).json({
        error: "shippo_transaction_failed",
        messages: transaction.messages,
      });
    }

    const labelUrl = transaction.label_url;
    const trackingNumber = transaction.tracking_number;

    const existingShipment = await pool.query(
      "SELECT id FROM shipments WHERE offer_id = $1",
      [offer_id]
    );

    let shipment;

    if (existingShipment.rows.length > 0) {
      const upd = await pool.query(
        `UPDATE shipments
         SET seller_id = $1,
             buyer_id = $2,
             carrier = $3,
             tracking_number = $4,
             label_url = $5,
             shipping_status = 'label_created',
             updated_at = NOW()
         WHERE offer_id = $6
         RETURNING *`,
        [
          od.owner_id,
          od.sender_id,
          transaction.provider,
          trackingNumber,
          labelUrl,
          offer_id,
        ]
      );
      shipment = upd.rows[0];
    } else {
      const ins = await pool.query(
        `INSERT INTO shipments 
           (offer_id, seller_id, buyer_id, carrier, tracking_number, label_url, shipping_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'label_created')
         RETURNING *`,
        [
          offer_id,
          od.owner_id,
          od.sender_id,
          transaction.provider,
          trackingNumber,
          labelUrl,
        ]
      );
      shipment = ins.rows[0];
    }

    const labelNote = await createNotification(
      od.owner_id,
      "sale_label_ready",
      offer_id,
      "A shipping label is ready for your order. Click to download and ship the package.",
      `/offer/${offer_id}/chat`
    );

    if (labelNote && req.sendLiveNotification) {
      req.sendLiveNotification(od.owner_id, labelNote);
    }

    const offerRes = await pool.query(
      "UPDATE offers SET sale_status = 'buyer_paid' WHERE id = $1 RETURNING *",
      [offer_id]
    );

    const offer = offerRes.rows[0];

    const buyerNote = await createNotification(
      offer.sender_id,
      "sale_payment_success_buyer",
      offer.id,
      "Your payment was successful. Waiting for the seller to ship your gift.",
      `/offer/${offer.id}/chat`
    );

    const sellerNote = await createNotification(
      offer.owner_id,
      "sale_payment_success_seller",
      offer.id,
      "The buyer has paid. Please ship the gift using a shipping label.",
      `/offer/${offer.id}/chat`
    );

    if (buyerNote && req.sendLiveNotification) {
      req.sendLiveNotification(offer.sender_id, buyerNote);
    }
    if (sellerNote && req.sendLiveNotification) {
      req.sendLiveNotification(offer.owner_id, sellerNote);
    }

    if (req.io) req.io.emit("offerUpdated", { offerId: offer.id });

    return res.json({
      success: true,
      message: "Sale payment confirmed. Waiting for seller shipment.",
      sale_status: "buyer_paid",
    });
  } catch (err) {
    console.error("❌ Error in /sale/confirm:", err.message);
    return res.status(500).json({ error: "Failed to confirm sale payment." });
  }
});

/* ============================================================
   3) تعليم الشحنة بأنها أُرسلت
   POST /api/sale/:offerId/mark-shipped
   ============================================================ */
router.post("/:offerId/mark-shipped", async (req, res) => {
  const { offerId } = req.params;
  const { user_id, tracking_number, carrier } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    const offerRes = await pool.query("SELECT * FROM offers WHERE id = $1", [
      offerId,
    ]);
    if (offerRes.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const offer = offerRes.rows[0];

    if (offer.offer_type !== "buy") {
      return res.status(400).json({ error: "This is not a sale offer." });
    }

    if (offer.owner_id !== Number(user_id)) {
      return res.status(403).json({
        error: "Only the seller can mark the shipment as shipped.",
      });
    }

    if (offer.sale_status !== "buyer_paid") {
      return res.status(400).json({
        error: "Sale must be in buyer_paid state to mark shipped.",
      });
    }

    // -----------------------------
    // 1) إما استخدام tracking يدوي
    //    أو شراء label من Shippo باستخدام selected_rate_id
    // -----------------------------
    let finalTracking = tracking_number || null;
    let finalCarrier = carrier || null;
    let labelUrl = null;

    // إذا لم يضع البائع tracking يدويًا ولدينا rate من Shippo → نشتري label الآن
    if (!finalTracking && offer.selected_rate_id) {
      try {
        const transaction = await shippo.transaction.create({
          rate: offer.selected_rate_id,
          label_file_type: "PDF",
        });

        if (transaction.status !== "SUCCESS") {
          console.error(
            "❌ Shippo Transaction Failed in mark-shipped:",
            transaction.messages
          );
          return res.status(500).json({
            error: "shippo_transaction_failed",
            messages: transaction.messages,
          });
        }

        finalTracking = transaction.tracking_number;
        finalCarrier = transaction.provider;
        labelUrl = transaction.label_url;
      } catch (err) {
        console.error("❌ Shippo transaction error in mark-shipped:", err);
        return res
          .status(500)
          .json({ error: "Failed to create shipping label via Shippo." });
      }
    }

    // -----------------------------
    // 2) تحديث / إنشاء سجل shipment
    // -----------------------------
    const existing = await pool.query(
      "SELECT id FROM shipments WHERE offer_id = $1",
      [offerId]
    );

    let shipment;

    if (existing.rows.length > 0) {
      const upd = await pool.query(
        `UPDATE shipments
         SET seller_id       = $1,
             buyer_id        = $2,
             carrier         = COALESCE($3, carrier),
             tracking_number = COALESCE($4, tracking_number),
             label_url       = COALESCE($5, label_url),
             shipping_status = 'shipped',
             updated_at      = NOW()
         WHERE offer_id = $6
         RETURNING *`,
        [
          offer.owner_id,
          offer.sender_id,
          finalCarrier,
          finalTracking,
          labelUrl,
          offerId,
        ]
      );
      shipment = upd.rows[0];
    } else {
      const ins = await pool.query(
        `INSERT INTO shipments (
            offer_id, seller_id, buyer_id,
            carrier, tracking_number, label_url,
            shipping_status, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'shipped', NOW())
         RETURNING *`,
        [
          offerId,
          offer.owner_id,
          offer.sender_id,
          finalCarrier,
          finalTracking,
          labelUrl,
        ]
      );
      shipment = ins.rows[0];
    }

    // -----------------------------
    // 3) تحديث حالة العرض + إشعار المشتري
    // -----------------------------
    await pool.query(
      "UPDATE offers SET sale_status = 'shipped' WHERE id = $1",
      [offerId]
    );

    const note = await createNotification(
      offer.sender_id,
      "sale_shipped",
      offer.id,
      "Seller has marked your gift as shipped.",
      `/offer/${offer.id}/chat`
    );

    if (note && req.sendLiveNotification) {
      req.sendLiveNotification(offer.sender_id, note);
    }

    if (req.io) req.io.emit("offerUpdated", { offerId });

    return res.json({
      success: true,
      message: "Shipment marked as shipped.",
      sale_status: "shipped",
      shipment,
    });
  } catch (err) {
    console.error("❌ mark-shipped error:", err.message);
    return res.status(500).json({
      error: "Failed to mark shipment as shipped.",
    });
  }
});

/* ============================================================
   4) تأكيد الاستلام من طرف المشتري
   POST /api/sale/:offerId/confirm-delivery
   ============================================================ */
router.post("/:offerId/confirm-delivery", async (req, res) => {
  const { offerId } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    const offerRes = await pool.query("SELECT * FROM offers WHERE id = $1", [
      offerId,
    ]);
    if (offerRes.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const offer = offerRes.rows[0];

    if (offer.sender_id !== Number(user_id)) {
      return res
        .status(403)
        .json({ error: "Only the buyer can confirm delivery." });
    }

    if (!["shipped", "in_transit"].includes(offer.sale_status)) {
      return res
        .status(400)
        .json({ error: "Sale is not in shipped state." });
    }

    await pool.query(
      `UPDATE shipments
       SET shipping_status = 'delivered',
           delivered_at = NOW(),
           updated_at = NOW()
       WHERE offer_id = $1`,
      [offerId]
    );

    await pool.query(
      "UPDATE offers SET sale_status = 'sale_completed' WHERE id = $1",
      [offerId]
    );

    const note = await createNotification(
      offer.owner_id,
      "sale_delivered_confirmed",
      offer.id,
      "Buyer has confirmed delivery. Sale completed.",
      `/offer/${offer.id}/chat`
    );

    if (note && req.sendLiveNotification) {
      req.sendLiveNotification(offer.owner_id, note);
    }

    if (req.io) req.io.emit("offerUpdated", { offerId });

    return res.json({
      success: true,
      message: "Delivery confirmed. Sale completed.",
      sale_status: "sale_completed",
    });
  } catch (err) {
    console.error("❌ confirm-delivery error:", err.message);
    return res.status(500).json({
      error: "Failed to confirm delivery.",
    });
  }
});

export default router;
