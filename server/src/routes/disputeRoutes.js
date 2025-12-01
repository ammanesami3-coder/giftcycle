// server/src/routes/disputeRoutes.js
import express from "express";
import pool from "../config/db.js";
import dotenv from "dotenv";
import Stripe from "stripe";

dotenv.config();

const router = express.Router();

console.log("🚀 disputeRoutes.js loaded");

// Stripe setup (نفس منطق saleRoutes)
const stripeSecretKey =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;

let stripe = null;
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey);
} else {
  console.warn("⚠️ Stripe secret key is not set. Dispute refunds will not work.");
}

// 🧩 دالة مساعدة لإنشاء إشعار
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
    console.error("⚠️ Failed to create notification (disputes):", err.message);
    return null;
  }
}

function isValidDealType(dealType) {
  return ["sale", "swap_equal", "swap_unequal"].includes(dealType);
}

/* =========================================================
   1) فتح نزاع جديد
   POST /api/disputes
   ========================================================= */
router.post("/", async (req, res) => {
  const { deal_type, deal_id, opened_by, reason_code, description } = req.body;

  if (!deal_type || !deal_id || !opened_by || !reason_code) {
    return res.status(400).json({
      error: "deal_type, deal_id, opened_by and reason_code are required.",
    });
  }

  if (!isValidDealType(deal_type)) {
    return res.status(400).json({ error: "Invalid deal_type." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // لا نسمح بأكثر من نزاع مفتوح لنفس deal
    const existing = await client.query(
      `SELECT id
       FROM disputes
       WHERE deal_type = $1 AND deal_id = $2 AND status = 'open'`,
      [deal_type, deal_id]
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ error: "There is already an open dispute for this deal." });
    }

    let finalOpenedByRole = null;

    // ========================
    // SALE
    // ========================
    if (deal_type === "sale") {
      const offerRes = await client.query(
        "SELECT * FROM offers WHERE id = $1 FOR UPDATE",
        [deal_id]
      );

      if (offerRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Sale offer not found." });
      }

      const offer = offerRes.rows[0];

      if (offer.offer_type !== "buy") {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "This offer is not a sale (buy) offer." });
      }

      const buyerId = offer.sender_id;
      const sellerId = offer.owner_id;

      if (opened_by !== buyerId && opened_by !== sellerId) {
        await client.query("ROLLBACK");
        return res
          .status(403)
          .json({ error: "You are not part of this sale deal." });
      }

      finalOpenedByRole = opened_by === buyerId ? "buyer" : "seller";

      // تحديث حالة البيع إلى under_dispute
      await client.query(
        "UPDATE offers SET sale_status = 'under_dispute' WHERE id = $1",
        [deal_id]
      );

      const otherUserId = opened_by === buyerId ? sellerId : buyerId;
      const note = await createNotification(
        otherUserId,
        "dispute_opened",
        deal_id,
        "A dispute was opened for this sale.",
        `/offer/${deal_id}/chat`
      );

      if (note && req.sendLiveNotification) {
        req.sendLiveNotification(otherUserId, note);
      }

      if (req.io) {
        req.io.emit("offerUpdated", { offerId: deal_id });
      }
    }

    // ========================
    // SWAP_EQUAL
    // ========================
    else if (deal_type === "swap_equal") {
      const offerRes = await client.query(
        "SELECT * FROM offers WHERE id = $1 FOR UPDATE",
        [deal_id]
      );

      if (offerRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Swap offer not found." });
      }

      const offer = offerRes.rows[0];
      const partyAId = offer.sender_id;
      const partyBId = offer.owner_id;

      const isParticipant = opened_by === partyAId || opened_by === partyBId;
      if (!isParticipant) {
        await client.query("ROLLBACK");
        return res
          .status(403)
          .json({ error: "You are not a participant in this swap." });
      }

      finalOpenedByRole = opened_by === partyAId ? "party_a" : "party_b";

      // مهم: لا نغيّر swap_status هنا لتفادي مشكلة CHECK constraint
      const otherUserId = opened_by === partyAId ? partyBId : partyAId;
      const note = await createNotification(
        otherUserId,
        "swap_dispute_opened",
        deal_id,
        "A dispute was opened for this protected swap.",
        `/offer/${deal_id}/chat`
      );

      if (note && req.sendLiveNotification) {
        req.sendLiveNotification(otherUserId, note);
      }

      if (req.io) {
        req.io.emit("offerUpdated", { offerId: deal_id });
      }
    }

    // ========================
    // SWAP_UNEQUAL (لاحقًا)
    // ========================
    else if (deal_type === "swap_unequal") {
      finalOpenedByRole = "party_a"; // placeholder مؤقت
    }

    const insertRes = await client.query(
      `INSERT INTO disputes (
         deal_type,
         deal_id,
         opened_by,
         opened_by_role,
         reason_code,
         description,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'open')
       RETURNING *`,
      [
        deal_type,
        deal_id,
        opened_by,
        finalOpenedByRole,
        reason_code,
        description || null,
      ]
    );

    await client.query("COMMIT");

    const dispute = insertRes.rows[0];
    return res.status(201).json(dispute);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error creating dispute:", err.message);
    return res.status(500).json({ error: "Failed to create dispute." });
  } finally {
    client.release();
  }
});

/* =========================================================
   1-bis) جلب قائمة النزاعات (للوحة المشرف)
   GET /api/disputes?status=open
   يمكن تمرير status أو تركه فارغًا
   ========================================================= */
router.get("/", async (req, res) => {
  const { status } = req.query;

  try {
    let query = "SELECT * FROM disputes";
    const params = [];

    if (status) {
      query += " WHERE status = $1";
      params.push(status);
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching disputes list:", err.message);
    return res.status(500).json({ error: "Failed to fetch disputes list." });
  }
});


/* =========================================================
   2) جلب آخر نزاع مرتبط بصفقة معينة
   GET /api/disputes/by-deal/:dealType/:dealId
   ========================================================= */
router.get("/by-deal/:dealType/:dealId", async (req, res) => {
  const { dealType, dealId } = req.params;

  if (!isValidDealType(dealType)) {
    return res.status(400).json({ error: "Invalid deal_type." });
  }

  try {
    const result = await pool.query(
      `SELECT *
       FROM disputes
       WHERE deal_type = $1 AND deal_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [dealType, dealId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No dispute found for this deal." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error fetching dispute by deal:", err.message);
    res.status(500).json({ error: "Failed to fetch dispute." });
  }
});

/* =========================================================
   3) جلب نزاع بالـ id
   GET /api/disputes/:id
   ========================================================= */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM disputes WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Dispute not found." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error fetching dispute by id:", err.message);
    res.status(500).json({ error: "Failed to fetch dispute." });
  }
});

/* =========================================================
   4) حلّ النزاع + Stripe refund
   PATCH /api/disputes/:id/resolve
   body: { action, admin_id, resolution_note }
   action:
     - sale: "refund_buyer" | "reject"
     - swap_equal: "refund_both_sides" | "reject"
   ========================================================= */
router.patch("/:id/resolve", async (req, res) => {
  const { id } = req.params;
  const { action, admin_id, resolution_note } = req.body;

  if (!action || !admin_id) {
    return res
      .status(400)
      .json({ error: "action and admin_id are required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const dispRes = await client.query(
      "SELECT * FROM disputes WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (dispRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Dispute not found." });
    }

    const dispute = dispRes.rows[0];

    if (dispute.status !== "open") {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Only open disputes can be resolved." });
    }

    const dealId = dispute.deal_id;
    const dealType = dispute.deal_type;

    /* ---------- SALE: refund_buyer / reject ---------- */
    if (dealType === "sale") {
      const offerRes = await client.query(
        "SELECT * FROM offers WHERE id = $1 FOR UPDATE",
        [dealId]
      );
      if (offerRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Sale offer not found." });
      }
      const offer = offerRes.rows[0];
      const buyerId = offer.sender_id;
      const sellerId = offer.owner_id;

      if (action === "refund_buyer") {
        if (!stripe) {
          await client.query("ROLLBACK");
          return res
            .status(500)
            .json({ error: "Stripe is not configured on the server." });
        }

        const payRes = await client.query(
          `SELECT *
           FROM payments
           WHERE offer_id = $1
             AND payment_type = 'sale_payment'
           ORDER BY id DESC
           LIMIT 1`,
          [dealId]
        );

        if (payRes.rows.length === 0) {
          await client.query("ROLLBACK");
          return res
            .status(404)
            .json({ error: "No sale payment found for this offer." });
        }

        const payment = payRes.rows[0];

        if (!payment.stripe_payment_intent_id) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Missing payment_intent for this payment." });
        }

        // إذا لم يكن مرفوض مسبقًا نقوم بعمل Refund (مع وضع تطوير لا يستدعي Stripe)
        if (payment.status !== "refunded") {
          if (process.env.NODE_ENV !== "production") {
            console.log(
              "DEV MODE: skipping real Stripe refund for payment",
              payment.id,
              "intent",
              payment.stripe_payment_intent_id
            );
          } else {
            try {
              await stripe.refunds.create({
                payment_intent: payment.stripe_payment_intent_id,
              });
            } catch (err) {
              await client.query("ROLLBACK");
              console.error("❌ Stripe refund error (sale):", err);
              return res.status(500).json({
                error: "Failed to create Stripe refund.",
                stripe_error: err.message,
              });
            }
          }

          await client.query(
  `UPDATE payments
   SET status = 'refunded'
   WHERE id = $1`,
  [payment.id]
);

        }

        await client.query(
          "UPDATE offers SET sale_status = 'refunded' WHERE id = $1",
          [dealId]
        );

        await client.query(
          `UPDATE disputes
           SET status = 'resolved_refunded',
               resolution_note = $1,
               resolved_by = $2,
               resolved_at = NOW()
           WHERE id = $3`,
          [resolution_note || "Buyer refunded.", admin_id, id]
        );

        // إشعارات
        const noteBuyer = await createNotification(
          buyerId,
          "sale_dispute_refunded_buyer",
          dealId,
          "Your dispute was resolved: you have been refunded.",
          `/offer/${dealId}/chat`
        );
        const noteSeller = await createNotification(
          sellerId,
          "sale_dispute_refunded_buyer",
          dealId,
          "The sale dispute was resolved: buyer has been refunded.",
          `/offer/${dealId}/chat`
        );

        if (noteBuyer && req.sendLiveNotification) {
          req.sendLiveNotification(buyerId, noteBuyer);
        }
        if (noteSeller && req.sendLiveNotification) {
          req.sendLiveNotification(sellerId, noteSeller);
        }

        if (req.io) {
          req.io.emit("offerUpdated", { offerId: dealId });
        }
      } else if (action === "reject") {
        await client.query(
          `UPDATE disputes
           SET status = 'resolved_rejected',
               resolution_note = $1,
               resolved_by = $2,
               resolved_at = NOW()
           WHERE id = $3`,
          [resolution_note || "Dispute rejected.", admin_id, id]
        );

        const noteBuyer = await createNotification(
          buyerId,
          "sale_dispute_rejected",
          dealId,
          "Your dispute was rejected by support.",
          `/offer/${dealId}/chat`
        );
        const noteSeller = await createNotification(
          sellerId,
          "sale_dispute_rejected",
          dealId,
          "The sale dispute was closed without refund.",
          `/offer/${dealId}/chat`
        );

        if (noteBuyer && req.sendLiveNotification) {
          req.sendLiveNotification(buyerId, noteBuyer);
        }
        if (noteSeller && req.sendLiveNotification) {
          req.sendLiveNotification(sellerId, noteSeller);
        }
      } else {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid action for sale." });
      }
    }

    /* ---------- SWAP_EQUAL: refund_both_sides / reject ---------- */
    else if (dealType === "swap_equal") {
      const offerRes = await client.query(
        "SELECT * FROM offers WHERE id = $1 FOR UPDATE",
        [dealId]
      );
      if (offerRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Swap offer not found." });
      }
      const offer = offerRes.rows[0];
      const partyAId = offer.sender_id;
      const partyBId = offer.owner_id;

      if (action === "refund_both_sides") {
        if (!stripe) {
          await client.query("ROLLBACK");
          return res
            .status(500)
            .json({ error: "Stripe is not configured on the server." });
        }

        const payRes = await client.query(
          `SELECT *
           FROM payments
           WHERE offer_id = $1
             AND payment_type = 'protection_fee'
             AND status IN ('succeeded','refunded')`,
          [dealId]
        );

        // حتى لو لم نجد أي دفعات، نكمل الحل لكن بدون Refund
        for (const payment of payRes.rows) {
          if (
            payment.status !== "refunded" &&
            payment.stripe_payment_intent_id
          ) {
            if (process.env.NODE_ENV !== "production") {
              console.log(
                "DEV MODE: skipping real Stripe refund for swap payment",
                payment.id,
                "intent",
                payment.stripe_payment_intent_id
              );
            } else {
              try {
                await stripe.refunds.create({
                  payment_intent: payment.stripe_payment_intent_id,
                });
              } catch (err) {
                await client.query("ROLLBACK");
                console.error(
                  "❌ Stripe refund error (swap_equal):",
                  err
                );
                return res.status(500).json({
                  error: "Failed to create Stripe refund.",
                  stripe_error: err.message,
                });
              }
            }

            await client.query(
  `UPDATE payments
   SET status = 'refunded'
   WHERE id = $1`,
  [payment.id]
);

          }
        }

        // نعتبر التبادل فشل
        await client.query(
          "UPDATE offers SET swap_status = 'failed_swap' WHERE id = $1",
          [dealId]
        );

        await client.query(
          `UPDATE disputes
           SET status = 'resolved_refunded',
               resolution_note = $1,
               resolved_by = $2,
               resolved_at = NOW()
           WHERE id = $3`,
          [resolution_note || "Both sides refunded.", admin_id, id]
        );

        const usersToNotify = [partyAId, partyBId];
        for (const uid of usersToNotify) {
          const note = await createNotification(
            uid,
            "swap_dispute_refunded_both",
            dealId,
            "The swap dispute was resolved: protection fees were refunded and the swap was marked as failed.",
            `/offer/${dealId}/chat`
          );
          if (note && req.sendLiveNotification) {
            req.sendLiveNotification(uid, note);
          }
        }

        if (req.io) {
          req.io.emit("offerUpdated", { offerId: dealId });
        }
      } else if (action === "reject") {
        await client.query(
          `UPDATE disputes
           SET status = 'resolved_rejected',
               resolution_note = $1,
               resolved_by = $2,
               resolved_at = NOW()
           WHERE id = $3`,
          [resolution_note || "Swap dispute rejected.", admin_id, id]
        );

        const usersToNotify = [partyAId, partyBId];
        for (const uid of usersToNotify) {
          const note = await createNotification(
            uid,
            "swap_dispute_rejected",
            dealId,
            "The swap dispute was closed without refund.",
            `/offer/${dealId}/chat`
          );
          if (note && req.sendLiveNotification) {
            req.sendLiveNotification(uid, note);
          }
        }
      } else {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "Invalid action for swap_equal." });
      }
    }

    // SWAP_UNEQUAL (لاحقًا)
    else if (dealType === "swap_unequal") {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Resolution for swap_unequal is not implemented yet." });
    }

    await client.query("COMMIT");

    const finalRes = await pool.query(
      "SELECT * FROM disputes WHERE id = $1",
      [id]
    );

    return res.json(finalRes.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error resolving dispute:", err.message);
    return res.status(500).json({ error: "Failed to resolve dispute." });
  } finally {
    client.release();
  }
});

export default router;
