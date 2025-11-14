import React, { useEffect, useState } from "react";
import { getSentOffers } from "../services/api";

const MyOffers = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  // مؤقتًا: سنستخدم إيميل ثابت حتى نضيف نظام تسجيل الدخول
  const userEmail = "sami@example.com";

  useEffect(() => {
    getSentOffers(userEmail)
      .then((data) => {
        setOffers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-500">Loading your offers...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <h1 className="text-2xl font-semibold text-center mb-6">My Offers</h1>

      {offers.length === 0 ? (
        <p className="text-center text-gray-600">You haven't sent any offers yet.</p>
      ) : (
        <div className="space-y-4 max-w-lg mx-auto">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="bg-white shadow-md rounded-lg p-4 border"
            >
              <p className="text-gray-800 font-semibold">
                Offer type: <span className="capitalize">{offer.offer_type}</span>
              </p>
              <p className="text-gray-600">Message: {offer.message}</p>
              <p className="text-gray-500 text-sm mt-2">
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
