import express from "express";
import pool from "../config/db.js";

const router = express.Router();

/*
  GET: جلب رسائل عرض معيّن
  /api/offers/:offer_id/messages
*/
router.get("/:offer_id/messages", async (req, res) => {
  try {
    const { offer_id } = req.params;

    const result = await pool.query(
      `SELECT offer_messages.*, users.name AS sender_name
       FROM offer_messages
       JOIN users ON users.id = offer_messages.sender_id
       WHERE offer_id = $1
       ORDER BY created_at ASC`,
      [offer_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching messages:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/*
  POST: إرسال رسالة جديدة
  /api/offers/:offer_id/messages
*/
router.post("/:offer_id/messages", async (req, res) => {
  try {
    const { offer_id } = req.params;
    const { sender_id, message } = req.body;

    if (!sender_id || !message) {
      return res.status(400).json({ error: "sender_id and message are required" });
    }

    const result = await pool.query(
      `INSERT INTO offer_messages (offer_id, sender_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [offer_id, sender_id, message]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error sending message:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
