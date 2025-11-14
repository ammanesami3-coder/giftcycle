import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// اختبار مباشر للتأكد من أن الملف يُحمَّل
console.log("🚀 offerRoutes.js loaded");

// استرجاع كل العروض الخاصة بهدية معينة
router.get("/:gift_id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM offers WHERE gift_id = $1 ORDER BY created_at DESC",
      [req.params.gift_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error in GET /offers/:gift_id:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// إضافة عرض جديد
router.post("/", async (req, res) => {
  try {
    const { gift_id, offer_type, message, sender_id, owner_id } = req.body;

    const result = await pool.query(
      `INSERT INTO offers (gift_id, offer_type, message, sender_id, owner_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [gift_id, offer_type, message, sender_id, owner_id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// جلب العروض التي أرسلها مستخدم معين
router.get("/sent/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM offers WHERE sender_email = $1 ORDER BY created_at DESC",
      [req.params.email]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// جلب كل العروض التي وصلَت لهدايا مستخدم معين
router.get("/received/:owner_id", async (req, res) => {
  try {
    const owner_id = req.params.owner_id;

    const offers = await pool.query(
      `SELECT offers.*, gifts.title AS gift_title
       FROM offers
       JOIN gifts ON gifts.id = offers.gift_id
       WHERE offers.owner_id = $1
       ORDER BY offers.created_at DESC`,
      [owner_id]
    );

    res.json(offers.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// تحديث حالة العرض (قبول / رفض)
router.patch("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { status } = req.body;
    const { id } = req.params;

    await client.query("BEGIN");

    // جلب معلومات العرض
    const offerResult = await client.query(
      "SELECT * FROM offers WHERE id = $1",
      [id]
    );
    if (offerResult.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const offer = offerResult.rows[0];

    // إذا العرض مقبول
    if (status === "accepted") {
      // 1. تحديث الهدية إلى locked
      await client.query(
        "UPDATE gifts SET gift_status = 'locked' WHERE id = $1",
        [offer.gift_id]
      );

      // 2. جعل كل العروض الأخرى expired
      await client.query(
        "UPDATE offers SET status = 'expired' WHERE gift_id = $1 AND id != $2",
        [offer.gift_id, id]
      );
    }

    // تحديث هذا العرض
    const updateResult = await client.query(
      "UPDATE offers SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    await client.query("COMMIT");

    res.json(updateResult.rows[0]);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating offer status:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
