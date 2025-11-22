import express from "express";
import pool from "../config/db.js";

const router = express.Router();

console.log("🚀 offerRoutes.js loaded");

// ==================================================
// 🧩 دالة مساعدة لإنشاء إشعار (مع دعم الرابط link)
// ==================================================
async function createNotification(user_id, type, reference_id, message, link = null) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, reference_id, message, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [user_id, type, reference_id, message, link]
    );
  } catch (err) {
    console.error("⚠️ Failed to create notification:", err.message);
  }
}

// ==================================================
// ✅ إدارة الرسائل (في الأعلى لتجنب تعارض المسارات)
// ==================================================

// جلب جميع الرسائل الخاصة بعرض محدد
router.get("/:offerId/messages", async (req, res) => {
  const { offerId } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM messages WHERE offer_id = $1 ORDER BY created_at ASC",
      [offerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching messages:", err.message);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// إرسال رسالة جديدة + إشعار للطرف الآخر
router.post("/:offerId/messages", async (req, res) => {
  const { offerId } = req.params;
  const { sender_id, message } = req.body;

  if (!sender_id || !message) {
    return res.status(400).json({ error: "sender_id and message are required" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO messages (offer_id, sender_id, message) VALUES ($1, $2, $3) RETURNING *",
      [offerId, sender_id, message]
    );

    // 🔔 إرسال إشعار للطرف الآخر
    const offer = await pool.query("SELECT sender_id, owner_id FROM offers WHERE id = $1", [
      offerId,
    ]);
    if (offer.rows.length > 0) {
      const targetUser =
        offer.rows[0].sender_id === sender_id
          ? offer.rows[0].owner_id
          : offer.rows[0].sender_id;

      await createNotification(
        targetUser,
        "message_received",
        offerId,
        "You received a new message.",
        `/offer/${offerId}/chat` // ✅ رابط مباشر للمحادثة
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error sending message:", err.message);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ✅ حذف رسالة (مع التحقق من المالك)
router.delete("/:offerId/messages/:msgId", async (req, res) => {
  const { offerId, msgId } = req.params;
  const { sender_id } = req.body;

  try {
    console.log("🟡 DELETE MESSAGE:", offerId, msgId, sender_id);

    const check = await pool.query(
      "SELECT sender_id FROM messages WHERE id = $1 AND offer_id = $2",
      [msgId, offerId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (sender_id && check.rows[0].sender_id !== sender_id) {
      return res.status(403).json({ error: "Not authorized to delete this message." });
    }

    await pool.query("DELETE FROM messages WHERE id = $1", [msgId]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error deleting message:", err.message);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

// ==================================================
// ✅ إدارة العروض
// ==================================================

// إضافة عرض جديد + إشعار لصاحب الهدية
router.post("/", async (req, res) => {
  try {
    const { gift_id, offer_type, message, sender_id, owner_id } = req.body;

    if (sender_id === owner_id) {
      return res.status(400).json({ error: "You cannot send an offer to your own gift." });
    }

    const exists = await pool.query(
      `SELECT id, status FROM offers 
       WHERE gift_id = $1 AND sender_id = $2 AND status IN ('pending', 'accepted')`,
      [gift_id, sender_id]
    );

    if (exists.rows.length > 0) {
      return res.status(400).json({ error: "You already sent an offer for this gift." });
    }

    const sender = await pool.query("SELECT name, email FROM users WHERE id = $1", [sender_id]);
    if (sender.rows.length === 0) {
      return res.status(400).json({ error: "Sender not found" });
    }

    const { name, email } = sender.rows[0];
    const result = await pool.query(
      `INSERT INTO offers (gift_id, offer_type, message, sender_id, sender_name, sender_email, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [gift_id, offer_type, message, sender_id, name, email, owner_id]
    );

        // 🔔 إشعار لصاحب الهدية مع توجيه إلى صفحة العروض الواردة
    const notification = await createNotification(
      owner_id,
      "offer_received",
      result.rows[0].id,
      `${name} sent you a new offer for your gift.`,
      `/offers-received` // ✅ هنا التغيير
    );


    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// العروض المرسلة من مستخدم معين
router.get("/sent/:sender_id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT offers.*, gifts.title AS gift_title
       FROM offers
       JOIN gifts ON gifts.id = offers.gift_id
       WHERE offers.sender_id = $1
       ORDER BY offers.created_at DESC`,
      [req.params.sender_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// العروض المستلمة لهدايا مستخدم معين
router.get("/received/:owner_id", async (req, res) => {
  try {
    const owner_id = req.params.owner_id;
    const offers = await pool.query(
      `SELECT offers.*, gifts.title AS gift_title, users.name AS sender_name, users.email AS sender_email
       FROM offers
       JOIN gifts ON gifts.id = offers.gift_id
       JOIN users ON users.id = offers.sender_id
       WHERE offers.owner_id = $1
       ORDER BY offers.created_at DESC`,
      [owner_id]
    );
    res.json(offers.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تحديث حالة العرض (قبول / رفض) + إشعار للمرسل
router.patch("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { status } = req.body;
    const { id } = req.params;

    await client.query("BEGIN");

    const offerResult = await client.query("SELECT * FROM offers WHERE id = $1", [id]);
    if (offerResult.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const offer = offerResult.rows[0];

    if (status === "accepted") {
      await client.query("UPDATE gifts SET gift_status = 'locked' WHERE id = $1", [offer.gift_id]);
      await client.query("UPDATE offers SET status = 'expired' WHERE gift_id = $1 AND id != $2", [
        offer.gift_id,
        id,
      ]);

      // 🔔 إشعار للمرسل بأن عرضه تم قبوله مع رابط للمحادثة
      await createNotification(
        offer.sender_id,
        "offer_accepted",
        offer.id,
        `Your offer for gift #${offer.gift_id} was accepted!`,
        `/offer/${offer.id}/chat` // ✅ يفتح محادثة العرض المقبول
      );
    }

    const updateResult = await client.query(
      "UPDATE offers SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    await client.query("COMMIT");
    res.json(updateResult.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating offer status:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// جلب عرض واحد فقط
router.get("/single/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM offers WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// حذف عرض (وليس رسالة)
router.delete("/delete/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM offers WHERE id = $1 RETURNING *", [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// جلب العروض الخاصة بهدية معينة (آخر مسار)
router.get("/:gift_id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM offers WHERE gift_id = $1 ORDER BY created_at DESC",
      [req.params.gift_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error in GET /offers/:gift_id:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
