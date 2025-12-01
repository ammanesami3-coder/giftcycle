// server/src/routes/shippoTestRoutes.js
import express from "express";
import { getShippoClient } from "../config/shippo.js";

const router = express.Router();

// اختبار بسيط لإنشاء عنوان بـ Shippo
router.post("/test-address", async (req, res) => {
  try {
    const shippo = getShippoClient();

    if (!shippo) {
      return res
        .status(500)
        .json({ error: "Shippo is not configured (missing SHIPPO_API_KEY)." });
    }

    const {
      name,
      street1,
      city,
      zip,
      state,
      country,
    } = req.body || {};

    const address = await shippo.address.create({
      name: name || "Test Receiver",
      street1: street1 || "Wilhelminenhofstr. 75A",
      city: city || "Berlin",
      zip: zip || "12459",
      state: state || "",
      country: country || "DE",
      validate: true,
    });

    return res.json(address);
  } catch (err) {
    console.error("❌ Shippo test-address error:", err);
    return res.status(500).json({
      error: "Shippo API error",
      message: err?.message || "Unknown error",
    });
  }
});

export default router;
