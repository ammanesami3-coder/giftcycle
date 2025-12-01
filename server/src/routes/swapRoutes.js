import express from "express";
import dotenv from "dotenv";
import Stripe from "stripe";
import pool from "../config/db.js";
import { createRequire } from "module";

dotenv.config();

const router = express.Router();

// ============================
// Stripe setup
// ============================
const stripeSecretKey =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;

if (!stripeSecretKey) {
  console.warn("⚠️ Stripe secret key is not set. Swap protection/shipping will not work.");
}

const stripe = new Stripe(stripeSecretKey);

// ============================
// Shippo setup (swap shipping)
// ============================
const require = createRequire(import.meta.url);
const shippoPackage = require("shippo");

const shippoToken =
  process.env.SHIPPO_API_TOKEN || process.env.SHIPPO_API_KEY;

console.log("Shippo token loaded?", shippoToken ? "YES" : "NO");

let shippo = null;

if (!shippoToken) {
  console.warn("⚠️ Shippo API token is not set. Swap shipping labels will not work.");
} else {
  shippo = shippoPackage(shippoToken);
}

// ============================
// Helpers
// ============================

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

async function getOfferForUser(offerId, userId) {
  const offerRes = await pool.query("SELECT * FROM offers WHERE id = $1", [
    offerId,
  ]);
  if (offerRes.rows.length === 0) {
    return { error: "Offer not found" };
  }

  const offer = offerRes.rows[0];
  const isParticipant = offer.sender_id === userId || offer.owner_id === userId;

  if (!isParticipant) {
    return { error: "You are not a participant in this offer." };
  }

  return { offer };
}

// قص street1 إلى 50 حرفًا كحد أقصى حتى لا يعترض Shippo
function safeStreet1(str, fallback) {
  const base = (str && String(str).trim()) || fallback || "Street 1";
  return base.slice(0, 50);
}

// تحويل صف swap_addresses إلى عنوان Shippo
function makeShippoAddress(row, fallback) {
  const defaults = fallback || {};
  return {
    name: row.full_name || defaults.name || "GiftCycle User",
    // ندعم كلا الاسمين: address_line1 أو street1
    street1: safeStreet1(
      row.address_line1 || row.street1,
      defaults.street1 || "731 Market St"
    ),
    city: row.city || defaults.city || "San Francisco",
    state: row.state || defaults.state || "CA",
    zip: row.zip || defaults.zip || "94103",
    country: row.country || defaults.country || "US",
    phone: row.phone || defaults.phone || "4155551234",
    email: defaults.email || "user@example.com",
  };
}

// إنشاء شحنة + label واحدة (تُستخدم في الـ flow القديم create)
async function createShippoShipment({ fromAddress, toAddress, weightKg }) {
  if (!shippo) {
    throw new Error("Shippo is not configured on the server.");
  }

  const parcelData = {
    weight: weightKg || 0.5,
    mass_unit: "kg",
    length: 20,
    width: 15,
    height: 10,
    distance_unit: "cm",
  };

  const shipment = await shippo.shipment.create({
    address_from: fromAddress,
    address_to: toAddress,
    parcels: [parcelData],
    async: false,
  });

  if (!shipment || !shipment.rates || shipment.rates.length === 0) {
    throw new Error("No rates returned from Shippo for this shipment.");
  }

  // نختار أرخص Rate متاحة
  const sorted = [...shipment.rates].sort(
    (a, b) => parseFloat(a.amount) - parseFloat(b.amount)
  );
  const rate = sorted[0];

  const transaction = await shippo.transaction.create({
    rate: rate.object_id,
    label_file_type: "PDF",
    async: false,
  });

  if (transaction.status !== "SUCCESS") {
    const msg =
      (transaction.messages && transaction.messages[0]?.text) ||
      "Failed to purchase label from Shippo.";
    throw new Error(msg);
  }

  return {
    label_url: transaction.label_url,
    tracking: transaction.tracking_number,
    track_url: transaction.tracking_url_provider,
    cost: rate.amount,
    provider: rate.provider,
    servicelevel_name: rate.servicelevel?.name || null,
  };
}

// الحصول على أرخص Rate فقط (بدون شراء label) – للـ quote
async function getCheapestShippoRate({ fromAddress, toAddress, weightKg }) {
  if (!shippo) {
    throw new Error("Shippo is not configured on the server.");
  }

  const parcelData = {
    weight: weightKg || 0.5,
    mass_unit: "kg",
    length: 20,
    width: 15,
    height: 10,
    distance_unit: "cm",
  };

  const shipment = await shippo.shipment.create({
    address_from: fromAddress,
    address_to: toAddress,
    parcels: [parcelData],
    async: false,
  });

  if (!shipment || !shipment.rates || shipment.rates.length === 0) {
    throw new Error("No rates returned from Shippo for this shipment.");
  }

  const sorted = [...shipment.rates].sort(
    (a, b) => parseFloat(a.amount) - parseFloat(b.amount)
  );
  const rate = sorted[0];

  return { shipment, rate };
}

// قراءة عنواني الطرفين من swap_addresses
async function getSwapAddresses(offerId) {
  const res = await pool.query(
    `SELECT *
     FROM swap_addresses
     WHERE offer_id = $1`,
    [offerId]
  );
  const rows = res.rows || [];
  const map = {};
  for (const r of rows) {
    map[r.user_id] = r;
  }
  return map;
}

// ============================
// 0) حفظ عنوان المستخدم للتبادل (متوافق مع جدولك)
// POST /api/swap/:offerId/address
// ============================
router.post("/:offerId/address", async (req, res) => {
  const { offerId } = req.params;
  const {
    user_id,
    full_name,
    address_line1,
    city,
    state,
    zip,
    country,
    parcel_weight,
    phone,
  } = req.body;

  if (!user_id) return res.status(400).json({ error: "user_id is required" });

  try {
    const { offer, error } = await getOfferForUser(offerId, user_id);
    if (error) return res.status(403).json({ error });

    if (offer.swap_status !== "protected_active") {
      return res.status(400).json({
        error:
          "Swap must be in 'protected_active' state before entering shipping address.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO swap_addresses
        (offer_id, user_id, full_name, address_line1, city, state, zip, country, phone, parcel_weight, created_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW())
      ON CONFLICT (offer_id, user_id)
      DO UPDATE SET
        full_name     = EXCLUDED.full_name,
        address_line1 = EXCLUDED.address_line1,
        city          = EXCLUDED.city,
        state         = EXCLUDED.state,
        zip           = EXCLUDED.zip,
        country       = EXCLUDED.country,
        phone         = EXCLUDED.phone,
        parcel_weight = EXCLUDED.parcel_weight
      RETURNING *;
      `,
      [
        offerId,
        user_id,
        full_name || null,
        address_line1 || null,
        city || null,
        state || null,
        zip || null,
        country || null,
        phone || null,
        parcel_weight || null,
      ]
    );

    return res.json({ success: true, address: result.rows[0] });
  } catch (err) {
    console.error("❌ Error in /swap/address:", err.message);
    return res
      .status(500)
      .json({ error: "Database save failed — address not recorded." });
  }
});

// ===============================================
// 1) Start swap protection
// POST /api/swap/:offerId/initiate
// ===============================================
router.post("/:offerId/initiate", async (req, res) => {
  const { offerId } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    const { offer, error } = await getOfferForUser(offerId, user_id);
    if (error) return res.status(403).json({ error });

    if (["awaiting_payment", "protected_active", "completed"].includes(offer.swap_status)) {
      return res
        .status(400)
        .json({ error: "Swap protection is already in progress for this offer." });
    }

    await pool.query("UPDATE offers SET swap_status = 'awaiting_payment' WHERE id = $1", [
      offerId,
    ]);

    const otherUserId = offer.sender_id === user_id ? offer.owner_id : offer.sender_id;

    const note = await createNotification(
      otherUserId,
      "swap_protection_started",
      offerId,
      "The other user wants to protect this swap. Please pay your protection fee to activate secure exchange.",
      `/offer/${offerId}/chat`
    );

    if (note && req.sendLiveNotification) {
      req.sendLiveNotification(otherUserId, note);
    }

    return res.json({
      success: true,
      message: "Swap protection initiated. Both users must pay the protection fee.",
    });
  } catch (err) {
    console.error("❌ Error in /swap/initiate:", err.message);
    return res.status(500).json({ error: "Failed to initiate swap protection." });
  }
});

// ===============================================
// 2) Stripe checkout for protection fee
// POST /api/swap/:offerId/checkout
// ===============================================
router.post("/:offerId/checkout", async (req, res) => {
  const { offerId } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  if (!stripeSecretKey) {
    return res.status(500).json({ error: "Stripe is not configured on the server." });
  }

  try {
    const { offer, error } = await getOfferForUser(offerId, user_id);
    if (error) return res.status(403).json({ error });

    if (
      offer.swap_status !== "awaiting_payment" &&
      offer.swap_status !== "protected_active"
    ) {
      return res.status(400).json({
        error: "Swap protection is not in awaiting_payment state for this offer.",
      });
    }

    const amountCents = 149; // 1.49$
    const currency = process.env.STRIPE_CURRENCY || "usd";

    const payRes = await pool.query(
      `INSERT INTO payments (offer_id, payer_id, amount_cents, currency, payment_type, status)
       VALUES ($1, $2, $3, $4, 'protection_fee', 'pending')
       RETURNING id`,
      [offerId, user_id, amountCents, currency]
    );
    const paymentId = payRes.rows[0].id;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: "GiftCycle Swap Protection Fee",
              description: "Secure swap protection for your gift exchange.",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        offer_id: String(offerId),
        payer_id: String(user_id),
        payment_id: String(paymentId),
        payment_type: "protection_fee",
      },
      success_url: `${process.env.FRONTEND_URL}/swap-success?session_id={CHECKOUT_SESSION_ID}&offer_id=${offerId}`,
      cancel_url: `${process.env.FRONTEND_URL}/swap-cancel`,
    });

    await pool.query("UPDATE payments SET stripe_session_id = $1 WHERE id = $2", [
      session.id,
      paymentId,
    ]);

    return res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Error in /swap/checkout:", err.message);
    return res.status(500).json({ error: "Failed to create Stripe checkout session." });
  }
});

// ===============================================
// 3) Confirm Stripe payment (protection_fee + swap_shipping)
// POST /api/swap/confirm
// ===============================================
router.post("/confirm", async (req, res) => {
  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ error: "session_id is required" });
  }

  if (!stripeSecretKey) {
    return res.status(500).json({ error: "Stripe is not configured on the server." });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ error: "Payment is not completed." });
    }

    const { offer_id, payer_id, payment_id } = session.metadata || {};

    if (!offer_id || !payer_id || !payment_id) {
      return res.status(400).json({ error: "Missing metadata in Stripe session." });
    }

    const paymentUpdateRes = await pool.query(
      `UPDATE payments
       SET status = 'succeeded',
           stripe_payment_intent_id = $1
       WHERE id = $2
       RETURNING *`,
      [session.payment_intent, payment_id]
    );

    if (paymentUpdateRes.rows.length === 0) {
      return res.status(404).json({ error: "Payment record not found." });
    }

    const paymentRow = paymentUpdateRes.rows[0];
    const paymentType = paymentRow.payment_type;

    // --------------------------
    // A) Protection fee
    // --------------------------
    if (paymentType === "protection_fee") {
      const countRes = await pool.query(
        `SELECT COUNT(*) AS paid_count
         FROM payments
         WHERE offer_id = $1 AND payment_type = 'protection_fee' AND status = 'succeeded'`,
        [offer_id]
      );

      const paidCount = parseInt(countRes.rows[0].paid_count || "0", 10);

      if (paidCount >= 2) {
        const offerRes = await pool.query(
          "UPDATE offers SET swap_status = 'protected_active' WHERE id = $1 RETURNING *",
          [offer_id]
        );

        if (offerRes.rows.length > 0) {
          const offer = offerRes.rows[0];
          const usersToNotify = [offer.sender_id, offer.owner_id];

          for (const uid of usersToNotify) {
            const note = await createNotification(
              uid,
              "swap_protection_active",
              offer.id,
              "Swap protection is now active. You can safely exchange your gifts.",
              `/offer/${offer.id}/chat`
            );

            if (note && req.sendLiveNotification) {
              req.sendLiveNotification(uid, note);
            }
          }

          return res.json({
            success: true,
            message: "Payment confirmed. Swap protection is active for both users.",
            swap_status: "protected_active",
            bothPaid: true,
          });
        }
      }

      return res.json({
        success: true,
        message: "Payment confirmed for this user. Waiting for the other user to pay.",
        swap_status: "awaiting_payment",
        bothPaid: false,
      });
    }

    // --------------------------
    // B) Swap shipping payment → إنشاء label واحد لهذا المستخدم
    // --------------------------
    if (paymentType === "swap_shipping") {
      if (!shippo) {
        return res
          .status(500)
          .json({ error: "Shippo is not configured on the server." });
      }

      const offerIdNum = Number(offer_id);
      const payerIdNum = Number(payer_id);
      const rateObjectId = session.metadata?.rate_object_id;

      if (!rateObjectId) {
        return res.status(400).json({
          error: "Missing rate_object_id in Stripe session metadata.",
        });
      }

      const offerRes = await pool.query("SELECT * FROM offers WHERE id = $1", [
        offerIdNum,
      ]);
      if (offerRes.rows.length === 0) {
        return res.status(404).json({ error: "Offer not found for shipping." });
      }
      const offer = offerRes.rows[0];

      const addresses = await getSwapAddresses(offerIdNum);
      const isSender = offer.sender_id === payerIdNum;
      const otherUserId = isSender ? offer.owner_id : offer.sender_id;

      const fromRow = addresses[payerIdNum];
      const toRow = addresses[otherUserId];

      if (!fromRow || !toRow) {
        return res.status(400).json({
          error: "Both swap addresses must be saved before purchasing shipping.",
        });
      }

      const fromAddress = makeShippoAddress(fromRow, {
        name: isSender ? "Sender" : "Owner",
        street1: "731 Market St",
        city: "San Francisco",
        state: "CA",
        zip: "94103",
        country: "US",
      });

      const toAddress = makeShippoAddress(toRow, {
        name: isSender ? "Owner" : "Sender",
        street1: "350 5th Ave",
        city: "New York",
        state: "NY",
        zip: "10118",
        country: "US",
      });

      const transaction = await shippo.transaction.create({
        rate: rateObjectId,
        label_file_type: "PDF",
        async: false,
      });

      if (transaction.status !== "SUCCESS") {
        const msg =
          (transaction.messages && transaction.messages[0]?.text) ||
          "Failed to purchase label from Shippo.";
        console.error("❌ Shippo transaction error:", msg);
        return res.status(500).json({ error: msg });
      }

      const cost = (paymentRow.amount_cents || 0) / 100;

      const existingShip = await pool.query(
        `SELECT id
         FROM swap_shipments
         WHERE offer_id = $1 AND sender_user_id = $2`,
        [offerIdNum, payerIdNum]
      );
      if (existingShip.rows.length > 0) {
        const allShipments = await pool.query(
          `SELECT * FROM swap_shipments WHERE offer_id = $1 ORDER BY id ASC`,
          [offerIdNum]
        );
        return res.json({
          success: true,
          message: "Shipping label already exists for this user.",
          swap_status: offer.swap_status,
          bothPaid: false,
          shipments: allShipments.rows,
        });
      }

      const insertShip = await pool.query(
        `INSERT INTO swap_shipments
          (offer_id, sender_user_id, receiver_user_id, label_url, tracking_number, tracking_url, cost)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [
          offerIdNum,
          payerIdNum,
          otherUserId,
          transaction.label_url,
          transaction.tracking_number,
          transaction.tracking_url_provider,
          cost,
        ]
      );
      const shipmentRow = insertShip.rows[0];

      const countRes = await pool.query(
        `SELECT COUNT(*) AS cnt FROM swap_shipments WHERE offer_id = $1`,
        [offerIdNum]
      );
      const count = parseInt(countRes.rows[0].cnt || "0", 10);

      let newStatus = offer.swap_status;

      if (count === 1 && offer.swap_status !== "shipping_created") {
        const partialRes = await pool.query(
          `UPDATE offers
           SET swap_status = 'shipping_partial'
           WHERE id = $1
           RETURNING *`,
          [offerIdNum]
        );
        const updatedOffer = partialRes.rows[0] || offer;
        newStatus = updatedOffer.swap_status;

        const notePartner = await createNotification(
          otherUserId,
          "swap_partner_label_created",
          offerIdNum,
          "Your swap partner generated their shipping label. Please generate yours.",
          `/offer/${offerIdNum}/chat`
        );
        if (notePartner && req.sendLiveNotification) {
          req.sendLiveNotification(otherUserId, notePartner);
        }
      }

      if (count >= 2 && offer.swap_status !== "shipping_created") {
        const finalRes = await pool.query(
          `UPDATE offers
           SET swap_status = 'shipping_created'
           WHERE id = $1
           RETURNING *`,
          [offerIdNum]
        );
        const updatedOffer = finalRes.rows[0] || offer;
        newStatus = updatedOffer.swap_status;

        const usersToNotify = [updatedOffer.sender_id, updatedOffer.owner_id];

        for (const uid of usersToNotify) {
          const note = await createNotification(
            uid,
            "swap_shipping_ready",
            updatedOffer.id,
            "Both shipping labels are ready. You can ship your gifts.",
            `/offer/${updatedOffer.id}/chat`
          );
          if (note && req.sendLiveNotification) {
            req.sendLiveNotification(uid, note);
          }
        }
      }

      return res.json({
        success: true,
        message: "Shipping payment confirmed and label created.",
        swap_status: newStatus,
        bothPaid: false,
        shipment: shipmentRow,
      });
    }

    return res.json({
      success: true,
      message: "Payment confirmed.",
      payment_type: paymentType || null,
    });
  } catch (err) {
    console.error("❌ Error in /swap/confirm:", err.message);
    return res.status(500).json({ error: "Failed to confirm payment." });
  }
});
// 4-A) Get shipping quote (user-based, فردي)
// POST /api/swap/:offerId/shipping/quote
// ALIAS: POST /api/swap/:offerId/shipping/rates
// body: { user_id, from: { name, address_line1 }, parcel: { weight } }
async function handleSwapShippingQuote(req, res) {
  const { offerId } = req.params;
  const { user_id, from, parcel } = req.body;

  const userIdNum = Number(user_id);
  if (!userIdNum) {
    return res.status(400).json({ error: "user_id is required" });
  }

  if (!shippo) {
    return res
      .status(500)
      .json({ error: "Shippo is not configured on the server." });
  }

  try {
    const { offer, error } = await getOfferForUser(offerId, userIdNum);
    if (error) return res.status(403).json({ error });

    if (
      offer.swap_status !== "protected_active" &&
      offer.swap_status !== "shipping_partial"
    ) {
      return res.status(400).json({
        error:
          "Swap must be in 'protected_active' or 'shipping_partial' state to get shipping quotes.",
      });
    }

    const fullName = (from && from.name) || null;
    const street1Raw = (from && from.address_line1) || null;
    const street1 = street1Raw ? safeStreet1(street1Raw) : null;
    const weight = parcel && parcel.weight ? Number(parcel.weight) : null;

    if (!street1) {
      return res.status(400).json({
        error: "Address line is required to get a shipping quote.",
      });
    }

    // نحفظ عنوان هذا المستخدم في swap_addresses (بدون updated_at لأن الجدول لا يحتوي عليه)
    await pool.query(
      `
      INSERT INTO swap_addresses
        (offer_id, user_id, full_name, address_line1, parcel_weight, created_at)
      VALUES
        ($1,$2,$3,$4,$5, NOW())
      ON CONFLICT (offer_id, user_id)
      DO UPDATE SET
        full_name      = EXCLUDED.full_name,
        address_line1  = EXCLUDED.address_line1,
        parcel_weight  = EXCLUDED.parcel_weight
      `,
      [offerId, userIdNum, fullName, street1, weight]
    );

    // نتحقق أن شريك التبادل أدخل عنوانه
    const addresses = await getSwapAddresses(offerId);
    const otherUserId =
      offer.sender_id === userIdNum ? offer.owner_id : offer.sender_id;

    const partnerRow = addresses[otherUserId];

    if (!partnerRow) {
      return res.status(400).json({
        error:
          "We saved your address. Your swap partner must also add their address before we can show shipping quotes.",
      });
    }

    // عناوين ثابتة وصحيحة لـ Shippo لأغراض التطوير
    const fromAddress = {
      name: fullName || "GiftCycle User",
      street1: "731 Market St",
      city: "San Francisco",
      state: "CA",
      zip: "94103",
      country: "US",
      phone: "4155551234",
      email: "user@example.com",
    };

    const toAddress = {
      name: "Swap Partner",
      street1: "350 5th Ave",
      city: "New York",
      state: "NY",
      zip: "10118",
      country: "US",
      phone: "2125551234",
      email: "partner@example.com",
    };

    const { rate } = await getCheapestShippoRate({
      fromAddress,
      toAddress,
      weightKg: weight || 0.5,
    });

    return res.json({
      success: true,
      rate: {
        object_id: rate.object_id,
        amount: rate.amount,
        currency: rate.currency,
        provider: rate.provider,
        servicelevel_name: rate.servicelevel?.name || null,
        est_days: rate.est_delivery_days || rate.days || null,
      },
    });
  } catch (err) {
    console.error("❌ Error in /swap/shipping/quote:", err.message);
    return res.status(500).json({
      error: "Failed to get shipping quote for this swap.",
    });
  }
}

router.post("/:offerId/shipping/quote", handleSwapShippingQuote);
router.post("/:offerId/shipping/rates", handleSwapShippingQuote);


// ===============================================
// 4-B) Stripe checkout for swap shipping (label فردي)
// POST /api/swap/:offerId/shipping/checkout
// ALIAS: POST /api/swap/:offerId/shipping/pay
// ===============================================
async function handleSwapShippingCheckout(req, res) {
  const { offerId } = req.params;
  const { user_id, direction, rate_object_id, amount, currency } = req.body;

  const userIdNum = Number(user_id);
  if (!userIdNum) {
    return res.status(400).json({ error: "user_id is required" });
  }

  if (!stripeSecretKey) {
    return res
      .status(500)
      .json({ error: "Stripe is not configured on the server." });
  }

  if (!rate_object_id) {
    return res
      .status(400)
      .json({ error: "rate_object_id is required for shipping payment." });
  }

  try {
    const { offer, error } = await getOfferForUser(offerId, userIdNum);
    if (error) return res.status(403).json({ error });

    if (offer.offer_type === "buy") {
      return res.status(400).json({ error: "Swap shipping is for swaps only." });
    }

    if (
      offer.swap_status !== "protected_active" &&
      offer.swap_status !== "shipping_partial" &&
      offer.swap_status !== "shipping_created"
    ) {
      return res.status(400).json({
        error: "Swap must be active to pay for shipping.",
      });
    }

    const existingShipment = await pool.query(
      `SELECT id
       FROM swap_shipments
       WHERE offer_id = $1 AND sender_user_id = $2`,
      [offerId, userIdNum]
    );
    if (existingShipment.rows.length > 0) {
      return res.status(400).json({
        error: "You already have a shipping label for this swap.",
      });
    }

    const numericAmount = Number(amount);
    if (!numericAmount || !isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "Invalid shipping amount." });
    }

    const amountCents = Math.round(numericAmount * 100);
    const curr =
      (currency || process.env.STRIPE_CURRENCY || "usd").toLowerCase();

    const payRes = await pool.query(
      `INSERT INTO payments (offer_id, payer_id, amount_cents, currency, payment_type, status)
       VALUES ($1,$2,$3,$4,'swap_shipping','pending')
       RETURNING id`,
      [offerId, userIdNum, amountCents, curr]
    );
    const paymentId = payRes.rows[0].id;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: curr,
            product_data: {
              name: "GiftCycle Swap Shipping Label",
              description: "Shipping label for your protected swap.",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        offer_id: String(offerId),
        payer_id: String(userIdNum),
        payment_id: String(paymentId),
        payment_type: "swap_shipping",
        shipping_direction: direction || "",
        rate_object_id: String(rate_object_id),
      },
      success_url: `${process.env.FRONTEND_URL}/swap-success?session_id={CHECKOUT_SESSION_ID}&offer_id=${offerId}`,
      cancel_url: `${process.env.FRONTEND_URL}/swap-cancel`,
    });

    await pool.query("UPDATE payments SET stripe_session_id = $1 WHERE id = $2", [
      session.id,
      paymentId,
    ]);

    return res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Error in /swap/shipping/checkout:", err.message);
    return res.status(500).json({
      error: "Failed to create Stripe checkout for swap shipping.",
    });
  }
}

router.post("/:offerId/shipping/checkout", handleSwapShippingCheckout);
router.post("/:offerId/shipping/pay", handleSwapShippingCheckout);

// ===============================================
// 4 (قديمة) Create two swap shipments (A ↔ B) – legacy
// ===============================================
router.post("/:offerId/shipping/create", async (req, res) => {
  const { offerId } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    const { offer, error } = await getOfferForUser(offerId, user_id);
    if (error) return res.status(403).json({ error });

    if (offer.swap_status !== "protected_active") {
      return res.status(400).json({
        error: "Swap must be in 'protected_active' state to create shipping labels.",
      });
    }

    const addressesByUser = await getSwapAddresses(offerId);

    const addrOwner = addressesByUser[offer.owner_id];
    const addrSender = addressesByUser[offer.sender_id];

    if (!addrOwner || !addrSender) {
      return res.status(400).json({
        error:
          "Both users must submit their shipping address before generating labels.",
      });
    }

    const shipFromOwner = makeShippoAddress(addrOwner, {
      name: "Owner",
      street1: "731 Market St",
      city: "San Francisco",
      state: "CA",
      zip: "94103",
      country: "US",
    });

    const shipFromSender = makeShippoAddress(addrSender, {
      name: "Sender",
      street1: "350 5th Ave",
      city: "New York",
      state: "NY",
      zip: "10118",
      country: "US",
    });

    const weightOwner = addrOwner.parcel_weight || 0.5;
    const weightSender = addrSender.parcel_weight || 0.5;

    const label1 = await createShippoShipment({
      fromAddress: shipFromOwner,
      toAddress: shipFromSender,
      weightKg: Number(weightOwner),
    });

    const label2 = await createShippoShipment({
      fromAddress: shipFromSender,
      toAddress: shipFromOwner,
      weightKg: Number(weightSender),
    });

    const s1 = await pool.query(
      `
      INSERT INTO swap_shipments 
        (offer_id, sender_user_id, receiver_user_id, label_url, tracking_number, tracking_url, cost)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        offerId,
        offer.owner_id,
        offer.sender_id,
        label1.label_url,
        label1.tracking,
        label1.track_url,
        label1.cost,
      ]
    );

    const s2 = await pool.query(
      `
      INSERT INTO swap_shipments 
        (offer_id, sender_user_id, receiver_user_id, label_url, tracking_number, tracking_url, cost)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        offerId,
        offer.sender_id,
        offer.owner_id,
        label2.label_url,
        label2.tracking,
        label2.track_url,
        label2.cost,
      ]
    );

    await pool.query(
      "UPDATE offers SET swap_status = 'shipping_created' WHERE id = $1",
      [offerId]
    );

    return res.json({
      success: true,
      outbound: s1.rows[0],
      return: s2.rows[0],
    });
  } catch (err) {
    console.error("❌ Swap shipping creation error:", err.message);
    return res.status(500).json({ error: "Failed to generate swap shipping labels." });
  }
});

// ===============================================
// 5) Confirm receipt for one side
// POST /api/swap/:offerId/complete
// ===============================================
router.post("/:offerId/complete", async (req, res) => {
  const { offerId } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    const { offer, error } = await getOfferForUser(offerId, user_id);
    if (error) return res.status(403).json({ error });

    if (
      offer.swap_status !== "protected_active" &&
      offer.swap_status !== "shipping_created" &&
      offer.swap_status !== "completed"
    ) {
      return res.status(400).json({
        error: "Swap must be active/shipping to confirm receipt.",
      });
    }

    const isSender = offer.sender_id === user_id;
    const flagColumn = isSender ? "swap_sender_confirmed" : "swap_owner_confirmed";

    if (
      (isSender && offer.swap_sender_confirmed) ||
      (!isSender && offer.swap_owner_confirmed)
    ) {
      return res.json({
        success: true,
        message: "You already confirmed receipt for this swap.",
        swap_status: offer.swap_status,
        bothConfirmed: offer.swap_sender_confirmed && offer.swap_owner_confirmed,
      });
    }

    const updatedRes = await pool.query(
      `UPDATE offers
       SET ${flagColumn} = true
       WHERE id = $1
       RETURNING *`,
      [offerId]
    );
    const updatedOffer = updatedRes.rows[0];

    const bothConfirmed =
      updatedOffer.swap_sender_confirmed && updatedOffer.swap_owner_confirmed;

    if (bothConfirmed && updatedOffer.swap_status !== "completed") {
      const finalRes = await pool.query(
        `UPDATE offers
         SET swap_status = 'completed'
         WHERE id = $1
         RETURNING *`,
        [offerId]
      );
      const finalOffer = finalRes.rows[0];

      const usersToNotify = [finalOffer.sender_id, finalOffer.owner_id];

      for (const uid of usersToNotify) {
        const note = await createNotification(
          uid,
          "swap_completed",
          finalOffer.id,
          "Both users confirmed delivery. Swap is completed.",
          `/offer/${finalOffer.id}/chat`
        );
        if (note && req.sendLiveNotification) {
          req.sendLiveNotification(uid, note);
        }
      }

      return res.json({
        success: true,
        message: "Both users confirmed receipt. Swap completed.",
        swap_status: "completed",
        bothConfirmed: true,
      });
    }

    const otherUserId =
      updatedOffer.sender_id === user_id
        ? updatedOffer.owner_id
        : updatedOffer.sender_id;

    const note = await createNotification(
      otherUserId,
      "swap_partner_confirmed",
      updatedOffer.id,
      "The other user confirmed they received the gift.",
      `/offer/${updatedOffer.id}/chat`
    );
    if (note && req.sendLiveNotification) {
      req.sendLiveNotification(otherUserId, note);
    }

    return res.json({
      success: true,
      message: "You confirmed receipt. Waiting for the other user.",
      swap_status: updatedOffer.swap_status,
      bothConfirmed: false,
    });
  } catch (err) {
    console.error("❌ Error in /swap/complete:", err.message);
    return res.status(500).json({ error: "Failed to confirm swap completion." });
  }
});

// ===============================================
// 6) Mark swap as failed
// POST /api/swap/:offerId/fail
// ===============================================
router.post("/:offerId/fail", async (req, res) => {
  const { offerId } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    const { offer, error } = await getOfferForUser(offerId, user_id);
    if (error) return res.status(403).json({ error });

    if (
      offer.swap_status !== "protected_active" &&
      offer.swap_status !== "shipping_created"
    ) {
      return res
        .status(400)
        .json({ error: "Swap must be active/shipping to be marked as failed." });
    }

    const updateRes = await pool.query(
      "UPDATE offers SET swap_status = 'failed_swap' WHERE id = $1 RETURNING *",
      [offerId]
    );
    const updatedOffer = updateRes.rows[0];

    const usersToNotify = [updatedOffer.sender_id, updatedOffer.owner_id];

    for (const uid of usersToNotify) {
      const note = await createNotification(
        uid,
        "swap_failed",
        updatedOffer.id,
        "This protected swap was marked as failed.",
        `/offer/${updatedOffer.id}/chat`
      );
      if (note && req.sendLiveNotification) {
        req.sendLiveNotification(uid, note);
      }
    }

    return res.json({
      success: true,
      message: "Swap marked as failed.",
      swap_status: "failed_swap",
    });
  } catch (err) {
    console.error("❌ Error in /swap/fail:", err.message);
    return res.status(500).json({ error: "Failed to mark swap as failed." });
  }
});

// ===============================================
// 7) Get swap shipments for this offer (track)
// GET /api/swap/:offerId/shipping?user_id=XX
// ALIAS: GET /api/swap/:offerId/shipping/track?user_id=XX
// ===============================================
async function handleGetSwapShipments(req, res) {
  const { offerId } = req.params;
  const user_id = Number(req.query.user_id);

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    const { offer, error } = await getOfferForUser(offerId, user_id);
    if (error) return res.status(403).json({ error });

    const result = await pool.query(
      `SELECT *
       FROM swap_shipments
       WHERE offer_id = $1
       ORDER BY id ASC`,
      [offerId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching swap shipments:", err.message);
    return res.status(500).json({ error: "Failed to fetch swap shipments." });
  }
}

router.get("/:offerId/shipping", handleGetSwapShipments);
router.get("/:offerId/shipping/track", handleGetSwapShipments);

export default router;
