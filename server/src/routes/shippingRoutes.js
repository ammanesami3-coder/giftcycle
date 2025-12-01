// server/src/routes/shippingRoutes.js
import express from "express";
import { shippoRequest } from "../config/shippo.js";

const router = express.Router();

/**
 * 🧪 POST /api/shipping/test-label
 * اختبار إنشاء Shipment + Label داخل أمريكا (US → US)
 * حاليًا: نعتمد فقط على UPS لتجنب مشكلة USPS sender_info_missing.
 */
router.post("/test-label", async (req, res) => {
  try {
    console.log("🔄 /api/shipping/test-label called");

    // 1) عنوان المرسل (داخل أمريكا)
    const addressFrom = {
      name: "GiftCycle - Seller (Test)",
      street1: "444 Alaska Avenue",
      city: "Torrance",
      state: "CA",
      zip: "90503",
      country: "US",
      phone: "+18000000000",
      email: "seller@giftcycle.com",
    };

    // 2) عنوان المرسل إليه (داخل أمريكا أيضًا)
    const addressTo = {
      name: "GiftCycle - Buyer (Test)",
      street1: "350 5th Ave",
      city: "New York",
      state: "NY",
      zip: "10118",
      country: "US",
      phone: "+12120000000",
      email: "buyer@giftcycle.com",
    };

    // 3) بيانات الطرد — in/lb لتوافق UPS
    const parcel = {
      length: "10",
      width: "8",
      height: "4",
      distance_unit: "in",
      weight: "1",
      mass_unit: "lb",
    };

    // 4) إنشاء Shipment
    const shipment = await shippoRequest("/shipments/", {
      method: "POST",
      body: {
        address_from: addressFrom,
        address_to: addressTo,
        parcels: [parcel],
        async: false,
      },
    });

    if (!shipment || !Array.isArray(shipment.rates) || shipment.rates.length === 0) {
      console.error("⚠️ No rates returned from Shippo:", shipment);
      return res.status(400).json({
        error: "No rates returned from Shippo",
        raw: shipment,
      });
    }

    // 🔹 نستخدم UPS فقط في هذه المرحلة
    const upsRates = shipment.rates.filter((r) => r.provider === "UPS");

    if (upsRates.length === 0) {
      console.error("⚠️ No UPS rates available. Other providers:", shipment.rates.map(r => r.provider));
      return res.status(400).json({
        error:
          "No UPS rates available for this shipment. USPS is currently failing بسبب نقص بيانات البائع (email/phone) في حساب Shippo.",
        all_providers: shipment.rates.map((r) => ({
          provider: r.provider,
          amount: r.amount,
          currency: r.currency,
          service: r.servicelevel && r.servicelevel.name,
        })),
      });
    }

    // 6) اختيار أرخص Rate من UPS
    const selectedRate = upsRates.reduce((min, r) =>
      parseFloat(r.amount) < parseFloat(min.amount) ? r : min
    );

    console.log("📦 Selected UPS Rate (test-label):", {
      provider: selectedRate.provider,
      amount: selectedRate.amount,
      service: selectedRate.servicelevel?.name,
    });

    // 7) شراء الـ Label من UPS
    const transaction = await shippoRequest("/transactions/", {
      method: "POST",
      body: {
        rate: selectedRate.object_id,
        label_file_type: "PDF",
        async: false,
      },
    });

    if (!transaction || transaction.status !== "SUCCESS") {
      console.error("❌ Shippo /transactions error (UPS):", transaction);
      return res.status(502).json({
        error: "Shippo transaction (label) failed.",
        shippo_error: transaction,
      });
    }

    console.log("🧾 Label created (UPS):", transaction.label_url);

    return res.json({
      provider: selectedRate.provider,
      service: selectedRate.servicelevel?.name,
      amount: selectedRate.amount,
      currency: selectedRate.currency,
      tracking_number: transaction.tracking_number,
      tracking_url: transaction.tracking_url_provider,
      label_url: transaction.label_url,
      test: transaction.test,
    });
  } catch (err) {
    console.error("❌ /shipping/test-label error:", err);
    return res.status(500).json({
      error: "Shippo label failed",
      details: err.message,
    });
  }
});

/**
 * 📦 POST /api/shipping/rates
 * في هذه المرحلة: نعيد فقط UPS rates حتى يكون السلوك ثابتًا،
 * إلى أن تضبط USPS في لوحة Shippo.
 */
router.post("/rates", async (req, res) => {
  try {
    console.log("🔄 /api/shipping/rates called");

    const { fromAddress, toAddress, parcel } = req.body || {};

    if (!fromAddress || !toAddress || !parcel) {
      return res.status(400).json({
        error: "fromAddress, toAddress and parcel are required",
      });
    }

    const shipment = await shippoRequest("/shipments/", {
      method: "POST",
      body: {
        address_from: fromAddress,
        address_to: toAddress,
        parcels: [parcel],
        async: false,
      },
    });

    if (!shipment || !Array.isArray(shipment.rates) || shipment.rates.length === 0) {
      console.error("⚠️ No rates returned from Shippo (/rates):", shipment);
      return res.status(400).json({
        error: "No rates returned from Shippo",
        raw: shipment,
      });
    }

    // UPS فقط الآن
    let rates = shipment.rates.filter((r) => r.provider === "UPS");

    if (rates.length === 0) {
      return res.status(400).json({
        error:
          "No UPS rates available for given data. USPS قد يعيد أسعارًا، لكن إصدار الـ label سيفشل حتى تضبط بيانات البائع (email/phone) في حساب Shippo.",
        all_providers: shipment.rates.map((r) => ({
          provider: r.provider,
          amount: r.amount,
          currency: r.currency,
          service: r.servicelevel && r.servicelevel.name,
        })),
      });
    }

    // ترتيب من الأرخص للأغلى
    rates.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));

    const simplifiedRates = rates.map((r) => ({
      rate_id: r.object_id,
      provider: r.provider,
      service: r.servicelevel?.name,
      service_token: r.servicelevel?.token,
      amount: r.amount,
      currency: r.currency,
      estimated_days: r.estimated_days,
      duration_terms: r.duration_terms,
    }));

    return res.json({
      shipment_id: shipment.object_id,
      rates: simplifiedRates,
    });
  } catch (err) {
    console.error("❌ /shipping/rates error:", err);
    return res.status(500).json({
      error: "Failed to fetch shipping rates",
      details: err.message,
    });
  }
});

/**
 * 🧾 POST /api/shipping/create-label
 * يأخذ rate_id (من /rates) وينشئ label
 * يعمل مع UPS (ويمكن لاحقًا العمل مع USPS بعد ضبط الحساب)
 */
router.post("/create-label", async (req, res) => {
  try {
    console.log("🔄 /api/shipping/create-label called");

    const { rate_id, contextType, contextId } = req.body || {};

    if (!rate_id) {
      return res.status(400).json({
        error: "rate_id is required",
      });
    }

    const transaction = await shippoRequest("/transactions/", {
      method: "POST",
      body: {
        rate: rate_id,
        label_file_type: "PDF",
        async: false,
      },
    });

    if (!transaction || transaction.status !== "SUCCESS") {
      console.error("❌ Shippo /transactions error (/create-label):", transaction);
      return res.status(502).json({
        error: "Shippo transaction (label) failed.",
        shippo_error: transaction,
      });
    }

    console.log("🧾 Label created (/create-label):", transaction.label_url);

    return res.json({
      tracking_number: transaction.tracking_number,
      tracking_url: transaction.tracking_url_provider,
      label_url: transaction.label_url,
      test: transaction.test,
      provider: "UPS", // في هذه المرحلة نحن نستخدم UPS فقط
      contextType: contextType || null,
      contextId: contextId || null,
    });
  } catch (err) {
    console.error("❌ /shipping/create-label error:", err);
    return res.status(500).json({
      error: "Failed to create label",
      details: err.message,
    });
  }
});

export default router;
