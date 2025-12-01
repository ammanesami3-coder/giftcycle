// server/src/config/shippo.js
import dotenv from "dotenv";

dotenv.config();

const MODE = process.env.SHIPPO_MODE || "test";
const API_KEY = process.env.SHIPPO_API_KEY;

if (!API_KEY) {
  console.warn("⚠ SHIPPO_API_KEY missing — Shippo disabled.");
} else {
  console.log("✅ Shippo REST config loaded → MODE:", MODE);
}

const SHIPPO_BASE_URL = "https://api.goshippo.com";

/**
 * Helper عام لاستدعاء Shippo REST API
 *
 * usage:
 *   shippoRequest("/shipments/", {
 *     method: "POST",
 *     body: { ...payload }
 *   })
 */
export async function shippoRequest(path, { method = "GET", body } = {}) {
  if (!API_KEY) {
    throw new Error("Shippo disabled: SHIPPO_API_KEY not set");
  }

  const url = `${SHIPPO_BASE_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `ShippoToken ${API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const err = new Error(
      `Shippo API error: Status ${res.status} ${res.statusText}`
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
