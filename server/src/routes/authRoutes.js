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

    // إنشاء المستخدم الجديد (is_admin = FALSE افتراضيًا من الـ DB)
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, name, email, created_at, avatar_url, is_admin`,
      [name, email, hash]
    );

    const newUser = result.rows[0];

    res.json(newUser);
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

    // نحدد الأعمدة بدقة لتضمن is_admin
    const userQuery = await pool.query(
      `SELECT id, name, email, password_hash, avatar_url, created_at, is_admin
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (userQuery.rows.length === 0) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const user = userQuery.rows[0];

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    // إنشاء التوكن (إضافة is_admin في الـ payload مفيد مستقبلاً)
    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // إرسال جميع بيانات المستخدم بما فيها is_admin
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url || null,
        created_at: user.created_at || null,
        is_admin: user.is_admin, // ← المهم هنا
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
