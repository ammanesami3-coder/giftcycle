// server/src/server.js
import dotenv from "dotenv";
dotenv.config();
console.log("🚀 Loaded SHIPPO:", process.env.SHIPPO_API_KEY);
console.log("🔍 ENV READ TEST:", process.env.SHIPPO_API_KEY ? "OK" : "NOT FOUND");

import express from "express";
import cors from "cors";
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
import swapRoutes from "./routes/swapRoutes.js";
import saleRoutes from "./routes/saleRoutes.js";
import disputeRoutes from "./routes/disputeRoutes.js";
import shippingRoutes from "./routes/shippingRoutes.js";


const app = express();
const server = http.createServer(app);

// ✅ Socket.io
const io = new Server(server, {
  cors: { origin: "*" },
});

// map للمستخدمين المتصلين
const onlineUsers = new Map();

// 🧩 وظيفة بث إشعار مباشر
export const sendLiveNotification = (userId, notification) => {
  const socketId = onlineUsers.get(String(userId));
  if (socketId) {
    io.to(socketId).emit("notificationReceived", notification);
  }
};

// أحداث Socket.io
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on("registerUser", (userId) => {
    if (userId) {
      onlineUsers.set(String(userId), socket.id);
      console.log(`✅ Registered user ${userId} with socket ${socket.id}`);
    }
  });

  socket.on("joinOffer", (offerId) => {
    socket.join(`offer_${offerId}`);
    console.log(`👥 User joined room offer_${offerId}`);
  });

  socket.on("newMessage", (msg) => {
    if (msg.offer_id) {
      io.to(`offer_${msg.offer_id}`).emit("messageReceived", msg);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
    for (const [key, value] of onlineUsers.entries()) {
      if (value === socket.id) onlineUsers.delete(key);
    }
  });
});

// middleware
app.use(cors());
app.use(express.json());

// تمرير io و sendLiveNotification لكل request
app.use((req, res, next) => {
  req.io = io;
  req.sendLiveNotification = sendLiveNotification;
  next();
});

// ✅ المسارات
app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/gifts", giftRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/offers", offerMessageRoutes);
app.use("/api/swap", swapRoutes);
app.use("/api/sale", saleRoutes);
app.use("/api/disputes", disputeRoutes);
app.use("/api/shipping", shippingRoutes);

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
