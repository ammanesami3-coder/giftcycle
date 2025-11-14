import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import { useUser } from "../context/UserContext";

const GiftDetails = () => {
  const { id } = useParams();
  const { user } = useUser();

  const [gift, setGift] = useState(null);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(""); 
  const [message, setMessage] = useState("");

  // تحميل بيانات الهدية
  useEffect(() => {
    api
      .get(`/gifts/${id}`)
      .then((res) => {
        setGift(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleModalOpen = (type) => {
    setModalType(type);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("You must be logged in to send an offer.");
      return;
    }

    if (!gift?.owner_id) {
      alert("Error: This gift does not have an owner_id. Fix in backend.");
      return;
    }

    try {
      await api.post("/offers", {
        gift_id: gift.id,
        offer_type: modalType,
        message,
        sender_id: user.id,
        owner_id: gift.owner_id
      });

      alert("Offer sent successfully!");
      setModalOpen(false);
      setMessage("");

    } catch (err) {
      console.error("Error:", err);
      alert("Error sending offer.");
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading gift...</p>
      </div>
    );

  if (!gift)
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-red-600">Gift not found.</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-10 px-4">
      <div className="bg-white shadow-xl rounded-2xl overflow-hidden w-full max-w-md">

        <div className="bg-gray-100 flex justify-center h-[360px] border-b">
          <img
            src={gift.image_url}
            alt={gift.title}
            className="object-contain w-full h-full max-h-[340px]"
          />
        </div>

        <div className="p-6 text-center">
          <h2 className="text-2xl font-semibold">{gift.title}</h2>

          <p className="text-gray-600 mt-2">{gift.description}</p>

          <div className="flex justify-center gap-4 mt-4 mb-6">
            <span className="text-xl text-blue-600 font-bold">${gift.price}</span>
            <span className="bg-gray-200 px-3 py-1 text-sm rounded">{gift.category}</span>
          </div>

          <div className="flex justify-center gap-4 mb-6">
            <button
              onClick={() => handleModalOpen("exchange")}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded"
            >
              🔁 Exchange
            </button>
            <button
              onClick={() => handleModalOpen("buy")}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              💰 Buy
            </button>
          </div>

          <Link
            to="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded"
          >
            ← Back to Gifts
          </Link>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">

            <h3 className="text-xl font-semibold mb-4 text-center">
              {modalType === "buy"
                ? "💰 Send Purchase Request"
                : "🔁 Send Exchange Offer"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">

              <textarea
                className="w-full border p-3 rounded"
                rows="4"
                placeholder="Write your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              ></textarea>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="bg-gray-300 px-4 py-2 rounded"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                  Send
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GiftDetails;
