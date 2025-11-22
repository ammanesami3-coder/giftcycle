import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const router = express.Router();

// =====================================================
// REGISTER — إنشاء حساب جديد
// =====================================================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // تحقق من البريد الإلكتروني
    const exists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);

    // إنشاء المستخدم الجديد
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, name, email, created_at, avatar_url`,
      [name, email, hash]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// LOGIN — تسجيل الدخول
// =====================================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const userQuery = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userQuery.rows.length === 0) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const user = userQuery.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    // إنشاء التوكن
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // إرسال جميع بيانات المستخدم بما فيها avatar_url
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url || null, // ← الصورة المخصصة أو null
        created_at: user.created_at || null, // ← لتظهر في الصفحة
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
