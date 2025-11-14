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

export default router;
