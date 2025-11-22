import React, { useEffect, useState } from "react";
import { getReceivedOffers, updateOfferStatus } from "../services/api";
import { useUser } from "../context/UserContext";
import { Link } from "react-router-dom";

const OffersReceived = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  const { user } = useUser();

  useEffect(() => {
    if (!user) return;

    getReceivedOffers(user.id)
      .then((data) => {
        setOffers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  // قبول / رفض العرض
  const handleDecision = async (id, status) => {
    try {
      await updateOfferStatus(id, status);
      setOffers((prev) =>
        prev.map((offer) =>
          offer.id === id ? { ...offer, status } : offer
        )
      );
    } catch (err) {
      alert("Error updating offer status");
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 transition">
        <p className="text-gray-500 dark:text-gray-300">
          Loading received offers...
        </p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-10 px-4 transition">
      <h1 className="text-2xl font-semibold text-center mb-6 text-gray-800 dark:text-white">
        Offers Received
      </h1>

      {offers.length === 0 ? (
        <p className="text-center text-gray-600 dark:text-gray-400">
          No offers received yet for your gifts.
        </p>
      ) : (
        <div className="space-y-4 max-w-lg mx-auto">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 border border-gray-200 dark:border-gray-700 transition"
            >
              {/* عنوان الهدية */}
              <p className="text-gray-800 dark:text-gray-100 font-semibold">
                Gift:{" "}
                <span className="text-blue-600 dark:text-blue-400">
                  {offer.gift_title}
                </span>
              </p>

              <p className="text-gray-700 dark:text-gray-300 mt-1 capitalize">
                Offer type: {offer.offer_type}
              </p>

              <p className="mt-2 text-gray-600 dark:text-gray-300">
                Message: {offer.message}
              </p>

              <p className="mt-2 text-gray-800 dark:text-gray-100">
                From: {offer.sender_name} ({offer.sender_email})
              </p>

              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                Received at: {new Date(offer.created_at).toLocaleString()}
              </p>

              {/* حالة العرض */}
              <p className="mt-3 font-semibold">
                Status:{" "}
                <span
                  className={
                    offer.status === "accepted"
                      ? "text-green-600"
                      : offer.status === "rejected"
                      ? "text-red-600"
                      : "text-yellow-600"
                  }
                >
                  {offer.status}
                </span>
              </p>

              {/* زر المحادثة */}
              <Link
                to={`/offer/${offer.id}/chat`}
                className="text-blue-600 dark:text-blue-400 underline mt-3 inline-block"
              >
                Open Chat
              </Link>

              {/* أزرار القبول / الرفض */}
              {offer.status === "pending" && (
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => handleDecision(offer.id, "accepted")}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition"
                  >
                    Accept
                  </button>

                  <button
                    onClick={() => handleDecision(offer.id, "rejected")}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OffersReceived;
