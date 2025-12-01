import express from "express";
import pool from "../config/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM gifts ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, description, price, category, image_url, owner_id } = req.body;

    const result = await pool.query(
      `INSERT INTO gifts (title, description, price, category, image_url, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [title, description, price, category, image_url, owner_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/my/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      "SELECT * FROM gifts WHERE owner_id = $1 ORDER BY created_at DESC",
      [user_id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// جلب هدية واحدة حسب ID
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM gifts WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Gift not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error GET /gifts/:id:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// حذف هدية
router.delete("/:id", async (req, res) => {
  try {
    const giftId = req.params.id;

    // تحقق من الهدية
    const gift = await pool.query(
      "SELECT * FROM gifts WHERE id = $1",
      [giftId]
    );

    if (gift.rows.length === 0) {
      return res.status(404).json({ error: "Gift not found" });
    }

    // منع حذف الهدايا المغلقة
    if (gift.rows[0].gift_status === "locked") {
      return res.status(400).json({
        error: "You cannot delete a locked gift."
      });
    }

    // تنفيذ الحذف
    await pool.query(
      "DELETE FROM gifts WHERE id = $1",
      [giftId]
    );

    res.json({ success: true, message: "Gift deleted successfully" });

  } catch (err) {
    console.error("DELETE /gifts/:id ERROR:", err.message);
    res.status(500).json({ error: "Server error while deleting gift" });
  }
});

// جلب هدايا مشابهة
router.get("/similar/:id", async (req, res) => {
  try {
    const giftId = req.params.id;

    // جلب الهدية الأصلية
    const base = await pool.query(
      "SELECT category, price FROM gifts WHERE id = $1",
      [giftId]
    );

    if (base.rows.length === 0) {
      return res.status(404).json({ error: "Gift not found" });
    }

    const category = base.rows[0].category;
    const price = base.rows[0].price;

    // جلب هدايا مشابهة (نفس التصنيف + سعر قريب ±30%)
    const similar = await pool.query(
      `SELECT *
       FROM gifts
       WHERE id != $1
       AND category = $2
       AND price BETWEEN $3 AND $4
       ORDER BY RANDOM()
       LIMIT 6`,
      [giftId, category, price * 0.7, price * 1.3]
    );

    res.json(similar.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
