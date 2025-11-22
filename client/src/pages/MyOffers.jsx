import React, { useEffect, useState } from "react";
import { getSentOffers } from "../services/api";
import { useUser } from "../context/UserContext";
import { Link } from "react-router-dom";

const MyOffers = () => {
  const { user } = useUser();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    getSentOffers(user.id)
      .then((data) => {
        setOffers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-100 dark:bg-gray-900 transition">
        <p className="text-red-600 dark:text-red-400 text-lg font-semibold">
          You must be logged in to view your sent offers.
        </p>
      </div>
    );
  }

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 transition">
        <p className="text-gray-500 dark:text-gray-300">Loading your offers...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-10 px-4 transition">
      <h1 className="text-2xl font-semibold text-center mb-6 text-gray-800 dark:text-white">
        My Sent Offers
      </h1>

      {offers.length === 0 ? (
        <p className="text-center text-gray-600 dark:text-gray-400">
          You haven't sent any offers yet.
        </p>
      ) : (
        <div className="space-y-4 max-w-xl mx-auto">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 border border-gray-200 dark:border-gray-700 transition"
            >
              {/* Gift title */}
              <p className="text-gray-800 dark:text-gray-100 font-semibold">
                Gift:{" "}
                <Link
                  to={`/gift/${offer.gift_id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {offer.gift_title || "View Gift"}
                </Link>
              </p>

              {/* Chat link */}
              <Link
                to={`/offer/${offer.id}/chat`}
                className="text-blue-600 dark:text-blue-400 underline mt-2 block"
              >
                Open Chat
              </Link>

              {/* Offer type */}
              <div className="mt-2">
                <span
                  className={`px-2 py-1 rounded text-sm text-white ${
                    offer.offer_type === "buy"
                      ? "bg-green-600"
                      : "bg-yellow-600"
                  }`}
                >
                  {offer.offer_type.toUpperCase()}
                </span>
              </div>

              {/* Message */}
              <p className="mt-2 text-gray-600 dark:text-gray-300">
                Message: {offer.message}
              </p>

              {/* Status */}
              <p className="mt-2 text-sm font-semibold">
                Status:{" "}
                <span
                  className={
                    offer.status === "accepted"
                      ? "text-green-600"
                      : offer.status === "rejected"
                      ? "text-red-600"
                      : offer.status === "expired"
                      ? "text-gray-500 dark:text-gray-400"
                      : "text-yellow-600"
                  }
                >
                  {offer.status}
                </span>
              </p>

              {/* Date */}
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                Sent at: {new Date(offer.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyOffers;
