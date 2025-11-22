import express from "express";
import bcrypt from "bcrypt";
import pool from "../config/db.js";

const router = express.Router();

// =========================================================
// 1. Get user profile
// =========================================================
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT id, name, email, avatar_url, created_at FROM users WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =========================================================
// 2. Update user info (name, email, password)
// =========================================================
router.put("/:id/update", async (req, res) => {
  const { id } = req.params;
  const { name, email, password } = req.body;

  try {
    // Check if user exists
    const userCheck = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    if (userCheck.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    let passwordHash = userCheck.rows[0].password_hash;

    // إذا المستخدم أدخل كلمة مرور جديدة، نقوم بتشفيرها
    if (password && password.trim() !== "") {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // تحديث البيانات
    const updated = await pool.query(
      "UPDATE users SET name = $1, email = $2, password_hash = $3 WHERE id = $4 RETURNING id, name, email, avatar_url, created_at",
      [name, email, passwordHash, id]
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: updated.rows[0],
    });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Failed to update user profile" });
  }
});

// =========================================================
// 3. Update avatar (profile picture)
// =========================================================
router.put("/:id/avatar", async (req, res) => {
  const { id } = req.params;
  const { avatar_url } = req.body;

  if (!avatar_url) {
    return res.status(400).json({ error: "avatar_url is required" });
  }

  try {
    const result = await pool.query(
      "UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING avatar_url",
      [avatar_url, id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    res.json({
      success: true,
      avatar_url: result.rows[0].avatar_url,
    });
  } catch (err) {
    console.error("Error updating avatar:", err);
    res.status(500).json({ error: "Failed to update avatar" });
  }
});

// =========================================================
// 4. Get user stats (gifts, offers, etc.)
// =========================================================
router.get("/:id/stats", async (req, res) => {
  const { id } = req.params;

  try {
    const gifts = await pool.query("SELECT COUNT(*) FROM gifts WHERE owner_id = $1", [id]);
    const sent = await pool.query("SELECT COUNT(*) FROM offers WHERE sender_id = $1", [id]);
    const received = await pool.query("SELECT COUNT(*) FROM offers WHERE owner_id = $1", [id]);
    const accepted = await pool.query("SELECT COUNT(*) FROM offers WHERE owner_id = $1 AND status = 'accepted'", [id]);

    res.json({
      gifts: parseInt(gifts.rows[0].count),
      sent: parseInt(sent.rows[0].count),
      received: parseInt(received.rows[0].count),
      accepted: parseInt(accepted.rows[0].count),
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch user stats" });
  }
});

export default router;
