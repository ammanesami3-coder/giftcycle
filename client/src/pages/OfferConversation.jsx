import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import api from "../services/api";
import { useUser } from "../context/UserContext";
import toast from "react-hot-toast";

// الاتصال بـ Socket.io (تأكد أن الخادم فعلاً يستخدم socket.io)
const socket = io("http://localhost:5000", {
  transports: ["websocket"],
  reconnectionAttempts: 5,
});
const OfferConversation = () => {
  const { id } = useParams(); // offer_id
  const { user, loadingUser } = useUser();

  const [messages, setMessages] = useState([]);
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);

  const messagesEndRef = useRef(null);
  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  // تحميل الرسائل
  const loadMessages = async () => {
    try {
      const res = await api.get(`/offers/${id}/messages`);
      setMessages(res.data);
      scrollToBottom();
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  // تحميل بيانات العرض والرسائل
  useEffect(() => {
    const fetchData = async () => {
      try {
        const offerRes = await api.get(`/offers/single/${id}`);
        setOffer(offerRes.data);
        await loadMessages();
      } catch (err) {
        toast.error("Failed to load conversation.");
      }
      setLoading(false);
    };

    if (!loadingUser && user) fetchData();
  }, [id, loadingUser, user]);

  // ✅ Socket.io room setup
useEffect(() => {
  if (!user) return;

  // انضمام المستخدم لغرفة العرض
  socket.emit("joinOffer", id);

  // استقبال رسالة جديدة فورًا من السيرفر
  socket.on("messageReceived", (msg) => {
    setMessages((prev) => [...prev, msg]);
    scrollToBottom();
  });

  return () => {
    socket.off("messageReceived");
  };
}, [id, user]);


  // إرسال رسالة جديدة
  const handleSend = async () => {
  if (newMessage.trim() === "") return;
  try {
    const res = await api.post(`/offers/${id}/messages`, {
      sender_id: user.id,
      message: newMessage,
    });

    // ✅ بدلاً من إضافتها يدويًا هنا، فقط نبثها عبر Socket.io
    socket.emit("newMessage", res.data);

    // سيستقبلها المستلم والمرسل من event: "messageReceived"
    setNewMessage("");
    scrollToBottom();
  } catch {
    toast.error("Failed to send message.");
  }
};

  // تأكيد الحذف
  const handleDeleteConfirm = (msg) => {
    setSelectedMsg(msg);
    setConfirmDelete(true);
  };

  // حذف الرسالة
  const handleDeleteMessage = async () => {
    try {
      await api.delete(`/offers/${id}/messages/${selectedMsg.id}`, {
        data: { sender_id: user.id },
      });
      setMessages((prev) => prev.filter((msg) => msg.id !== selectedMsg.id));
      setConfirmDelete(false);
      toast.success("Message deleted successfully");
    } catch (err) {
      toast.error("Failed to delete message");
      console.error(err);
    }
  };

  if (loadingUser || loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-300">Loading...</p>
      </div>
    );

  if (!user || !offer)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-red-600 dark:text-red-400">
          Unable to load conversation.
        </p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-10 px-4">
      <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition">
        {/* Header */}
        <div className="bg-blue-600 dark:bg-blue-700 text-white p-4 text-center">
          <h2 className="text-lg font-semibold">Conversation</h2>
          <p className="text-sm opacity-90">
            Offer for Gift ID: {offer.gift_id}
          </p>
        </div>

        {/* Messages */}
        <div className="p-4 max-h-[500px] overflow-y-auto space-y-3 bg-gray-50 dark:bg-gray-900">
          {messages.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center">
              No messages yet.
            </p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${
                  msg.sender_id === user.id ? "justify-end" : "justify-start"
                }`}
              >
                {msg.sender_id !== user.id && (
                  <img
                    src={
                      msg.sender_avatar ||
                      "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                    }
                    alt="avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                )}

                <div
                  className={`relative px-4 py-2 rounded-lg shadow text-sm max-w-[80%] ${
                    msg.sender_id === user.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                  }`}
                >
                  <p>{msg.message}</p>
                  <span className="text-[10px] opacity-60 block mt-1">
                    {new Date(msg.created_at).toLocaleString()}
                  </span>

                  {msg.sender_id === user.id && (
                    <button
                      onClick={() => handleDeleteConfirm(msg)}
                      className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white text-xs rounded-full px-1"
                      title="Delete message"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {msg.sender_id === user.id && (
                  <img
                    src={
                      user.avatar_url ||
                      "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                    }
                    alt="your avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef}></div>
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800 flex gap-2">
          <input
            type="text"
            className="flex-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button
            onClick={handleSend}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
          >
            Send
          </button>
        </div>
      </div>

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg w-full max-w-sm text-center">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              Delete Message?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mt-2 mb-4">
              Are you sure you want to delete this message?
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMessage}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfferConversation;
