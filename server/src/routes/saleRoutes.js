import express from "express";
import dotenv from "dotenv";
import Stripe from "stripe";
import pool from "../config/db.js";

dotenv.config();

const router = express.Router();

// نختار مفتاح Stripe حسب البيئة
const stripeSecretKey =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;

if (!stripeSecretKey) {
  console.warn("⚠️ Stripe secret key is not set. Sale payments will not work.");
}

const stripe = new Stripe(stripeSecretKey);

// دالة مساعدة لإنشاء إشعار
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

// دالة مساعدة لجلب عرض بيع والتأكد أن user هو المشتري
// المرسل هو المشتري دائمًا (sender_id = buyer_id, owner_id = seller_id)
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

/*
  1) إنشاء Stripe Checkout للمشتري
  POST /api/sale/:offerId/checkout
  body: { user_id } (هو sender_id = buyer)
*/
router.post("/:offerId/checkout", async (req, res) => {
  const { offerId } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  if (!stripeSecretKey) {
    return res
      .status(500)
      .json({ error: "Stripe is not configured on the server." });
  }

  try {
    const { offer, error } = await getSaleOfferForBuyer(offerId, user_id);
    if (error) return res.status(403).json({ error });

    const currency = process.env.STRIPE_CURRENCY || "usd";

    // مبلغ تجريبي ثابت للـ MVP (مثلاً 9.99$)
    const amountCents = 999;

    // إنشاء سجل دفع "pending"
    const payRes = await pool.query(
      `INSERT INTO payments (offer_id, payer_id, amount_cents, currency, payment_type, status)
       VALUES ($1, $2, $3, $4, 'sale_payment', 'pending')
       RETURNING id`,
      [offerId, user_id, amountCents, currency]
    );
    const paymentId = payRes.rows[0].id;

    // إنشاء Checkout Session في Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: "Gift purchase on GiftCycle",
              description: "Gift sale with platform protection and shipping.",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        offer_id: String(offerId),
        buyer_id: String(user_id),
        payment_id: String(paymentId),
        type: "sale_payment",
      },
      success_url: `${process.env.FRONTEND_URL}/sale-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/sale-cancel`,
    });

    // حفظ session_id في جدول payments
    await pool.query(
      "UPDATE payments SET stripe_session_id = $1 WHERE id = $2",
      [session.id, paymentId]
    );

    return res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Error in /sale/:offerId/checkout:", err.message);
    return res.status(500).json({ error: "Failed to create sale checkout session." });
  }
});

/*
  2) تأكيد الدفع بعد العودة من Stripe
  POST /api/sale/confirm
  body: { session_id }
*/
router.post("/confirm", async (req, res) => {
  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ error: "session_id is required" });
  }

  if (!stripeSecretKey) {
    return res
      .status(500)
      .json({ error: "Stripe is not configured on the server." });
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
        .json({ error: "Missing or invalid metadata in Stripe session." });
    }

    // تحديث سجل الدفع إلى succeeded
    await pool.query(
      `UPDATE payments
       SET status = 'succeeded',
           stripe_payment_intent_id = $1
       WHERE id = $2`,
      [session.payment_intent, payment_id]
    );

    // تحديث حالة البيع في offers -> buyer_paid
    const offerRes = await pool.query(
      "UPDATE offers SET sale_status = 'buyer_paid' WHERE id = $1 RETURNING *",
      [offer_id]
    );

    if (offerRes.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Offer not found while updating sale_status." });
    }

    const offer = offerRes.rows[0];

    // إشعار للمشتري
    const buyerNote = await createNotification(
      offer.sender_id,
      "sale_payment_success_buyer",
      offer.id,
      "Your payment was successful. Waiting for the seller to ship your gift.",
      `/offer/${offer.id}/chat`
    );

    // إشعار للبائع
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

    // بثّ تحديث العرض
    if (req.io) {
      req.io.emit("offerUpdated", { offerId: offer.id });
    }

    return res.json({
      success: true,
      message: "Sale payment confirmed. Waiting for the seller to ship.",
      sale_status: "buyer_paid",
    });
  } catch (err) {
    console.error("❌ Error in /sale/confirm:", err.message);
    return res.status(500).json({ error: "Failed to confirm sale payment." });
  }
});

/*
  3) تعليم الشحنة بأنها أُرسلت (للبائع فقط)
  POST /api/sale/:offerId/mark-shipped
  body: { user_id, tracking_number?, carrier? }
*/
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
      return res.status(400).json({ error: "This offer is not a sale offer." });
    }

    // المالك هو البائع
    if (offer.owner_id !== user_id) {
      return res
        .status(403)
        .json({ error: "Only the seller can mark shipment as shipped." });
    }

    if (offer.sale_status !== "buyer_paid") {
      return res.status(400).json({ error: "Sale is not in buyer_paid state." });
    }

    // إدخال أو تحديث سجل الشحنة
    const existing = await pool.query(
      "SELECT id FROM shipments WHERE offer_id = $1",
      [offerId]
    );

    let shipment;

    if (existing.rows.length > 0) {
      const upd = await pool.query(
        `UPDATE shipments
         SET seller_id = $1,
             buyer_id = $2,
             carrier = COALESCE($3, carrier),
             tracking_number = COALESCE($4, tracking_number),
             shipping_status = 'shipped',
             updated_at = NOW()
         WHERE offer_id = $5
         RETURNING *`,
        [offer.owner_id, offer.sender_id, carrier || null, tracking_number || null, offerId]
      );
      shipment = upd.rows[0];
    } else {
      const ins = await pool.query(
        `INSERT INTO shipments (offer_id, seller_id, buyer_id, carrier, tracking_number, shipping_status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'shipped', NOW())
         RETURNING *`,
        [offerId, offer.owner_id, offer.sender_id, carrier || null, tracking_number || null]
      );
      shipment = ins.rows[0];
    }

    // تحديث حالة البيع في offers -> shipped
    const updatedOfferRes = await pool.query(
      "UPDATE offers SET sale_status = 'shipped' WHERE id = $1 RETURNING *",
      [offerId]
    );
    const updatedOffer = updatedOfferRes.rows[0];

    // إشعار للمشتري بأن الهدية تم شحنها
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

    // بثّ تحديث العرض
    if (req.io) {
      req.io.emit("offerUpdated", { offerId });
    }

    return res.json({
      success: true,
      message: "Shipment marked as shipped.",
      sale_status: updatedOffer.sale_status,
      shipment,
    });
  } catch (err) {
    console.error("❌ Error in /sale/:offerId/mark-shipped:", err.message);
    return res.status(500).json({ error: "Failed to mark shipment as shipped." });
  }
});

/*
  4) تأكيد استلام الطرد من طرف المشتري
  POST /api/sale/:offerId/confirm-delivery
  body: { user_id }
*/
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

    // التحقق أن المستخدم هو المشتري
    if (offer.sender_id !== user_id) {
      return res
        .status(403)
        .json({ error: "Only the buyer can confirm delivery." });
    }

    // يجب أن تكون الحالة على الأقل shipped
    if (!["shipped", "in_transit"].includes(offer.sale_status)) {
      return res
        .status(400)
        .json({ error: "Offer is not in shipped/in_transit state." });
    }

    // تحديث سجل الشحنة إن وجد
    await pool.query(
      `UPDATE shipments
       SET shipping_status = 'delivered', delivered_at = NOW()
       WHERE offer_id = $1`,
      [offerId]
    );

    // تحديث حالة العرض إلى sale_completed
    const updatedOfferRes = await pool.query(
      "UPDATE offers SET sale_status = 'sale_completed' WHERE id = $1 RETURNING *",
      [offerId]
    );

    const updatedOffer = updatedOfferRes.rows[0];

    // إشعار للبائع بأن المشتري أكّد الاستلام
    const note = await createNotification(
      offer.owner_id,
      "sale_delivered_confirmed",
      offer.id,
      "Buyer has confirmed delivery. Sale is completed.",
      `/offer/${offer.id}/chat`
    );

    if (note && req.sendLiveNotification) {
      req.sendLiveNotification(offer.owner_id, note);
    }

    // بثّ تحديث العرض
    if (req.io) {
      req.io.emit("offerUpdated", { offerId });
    }

    return res.json({
      success: true,
      message: "Delivery confirmed. Sale completed.",
      sale_status: updatedOffer.sale_status,
    });
  } catch (err) {
    console.error(
      "❌ Error in /sale/:offerId/confirm-delivery:",
      err.message
    );
    return res.status(500).json({ error: "Failed to confirm delivery." });
  }
});

export default router;
