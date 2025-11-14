import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/db.js";
import expressListEndpoints from "express-list-endpoints";

import giftRoutes from "./routes/giftRoutes.js";
import offerRoutes from "./routes/offerRoutes.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

// Routes
try {
  app.use("/api/gifts", giftRoutes);
  console.log("✅ giftRoutes loaded successfully");
} catch (err) {
  console.error("❌ Error loading giftRoutes:", err);
}

try {
  app.use("/api/offers", offerRoutes);
  console.log("✅ offerRoutes loaded successfully");
} catch (err) {
  console.error("❌ Error loading offerRoutes:", err);
}


// Check DB connection
pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch(err => console.error("❌ DB connection error:", err.message));

// Debug active endpoints
console.log("📍 Active Endpoints:");
console.table(expressListEndpoints(app));

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
