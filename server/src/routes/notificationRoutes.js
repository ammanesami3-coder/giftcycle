import express from "express";
import pool from "../config/db.js";

const router = express.Router();

/* ======================================================
   📩 Notifications Routes (for offers & messages)
====================================================== */

// جلب جميع الإشعارات الخاصة بمستخدم معين
router.get("/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
      [user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching notifications:", err.message);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// إنشاء إشعار جديد ✅ (مع دعم حقل link)
router.post("/", async (req, res) => {
  try {
    const { user_id, type, reference_id, message, link } = req.body;

    if (!user_id || !type || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, reference_id, message, link)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user_id, type, reference_id || null, message, link || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error creating notification:", err.message);
    res.status(500).json({ error: "Failed to create notification" });
  }
});

// وضع علامة تمت القراءة على إشعار معين
router.patch("/:id/read", async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Notification not found" });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// حذف إشعار
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM notifications WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Notification not found" });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
