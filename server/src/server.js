import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/db.js";
import expressListEndpoints from "express-list-endpoints";
import http from "http";
import { Server } from "socket.io";

import giftRoutes from "./routes/giftRoutes.js";
import offerRoutes from "./routes/offerRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import offerMessageRoutes from "./routes/offerMessageRoutes.js";
import userRoutes from "./routes/users.js";
import notificationRoutes from "./routes/notificationRoutes.js";

dotenv.config();
const app = express();
const server = http.createServer(app); // ✅ استخدام http لتمكين Socket.io

// ✅ إعداد Socket.io
const io = new Server(server, {
  cors: { origin: "*" },
});

// تخزين sockets النشطة للمستخدمين (userId => socket.id)
const onlineUsers = new Map();

// 🧩 وظيفة لبث إشعار فوري لمستخدم معين
export const sendLiveNotification = (userId, notification) => {
  const socketId = onlineUsers.get(String(userId));
  if (socketId) {
    io.to(socketId).emit("notificationReceived", notification);
  }
};

// ✅ الأحداث الخاصة بـ Socket.io
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // 📦 انضمام المستخدم بغرض استقبال إشعاراته الشخصية
  socket.on("registerUser", (userId) => {
    if (userId) {
      onlineUsers.set(String(userId), socket.id);
      console.log(`✅ Registered user ${userId} with socket ${socket.id}`);
    }
  });

  // 🗂 الانضمام لغرفة المحادثة الخاصة بعرض
  socket.on("joinOffer", (offerId) => {
    socket.join(`offer_${offerId}`);
    console.log(`👥 User joined room offer_${offerId}`);
  });

  // 📨 بث رسالة جديدة لجميع أعضاء الغرفة
  socket.on("newMessage", (msg) => {
    if (msg.offer_id) {
      io.to(`offer_${msg.offer_id}`).emit("messageReceived", msg);
    }
  });

  // 🛑 قطع الاتصال
  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
    for (const [key, value] of onlineUsers.entries()) {
      if (value === socket.id) onlineUsers.delete(key);
    }
  });
});

// ✅ إضافة Socket.io في كائن الطلب ليستفيد منه Routes عند إرسال إشعارات
app.use((req, res, next) => {
  req.io = io;
  req.sendLiveNotification = sendLiveNotification;
  next();
});

// Middleware
app.use(cors());
app.use(express.json());

// ✅ المسارات
app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/gifts", giftRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/offers", offerMessageRoutes);

// ✅ قاعدة البيانات
pool
  .connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => console.error("❌ DB connection error:", err.message));

// ✅ نقاط الـ API النشطة
console.log("📍 Active Endpoints:");
console.table(expressListEndpoints(app));

// ✅ تشغيل الخادم
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running with Socket.io on port ${PORT}`);
});
