import React, { useEffect, useState } from "react";
import api from "../services/api";

const Home = () => {
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/gifts")
      .then((res) => {
        setGifts(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-500 text-lg">Loading gifts...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm py-4 mb-6">
        <h1 className="text-center text-3xl font-semibold text-gray-800">
          🎁 GiftCycle Marketplace
        </h1>
        <p className="text-center text-gray-500 mt-1">
          Exchange, sell, or find your next gift!
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-12">
        {gifts.length === 0 ? (
          <p className="text-center text-gray-500 mt-10">No gifts added yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {gifts.map((gift) => (
              <div
  key={gift.id}
  className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition transform hover:-translate-y-1 cursor-pointer"
  onClick={() => window.location.href = `/gift/${gift.id}`}
>
  <div className="w-full h-56 bg-gray-100 flex items-center justify-center overflow-hidden">
    <img
      src={gift.image_url || "https://via.placeholder.com/150"}
      alt={gift.title}
      className="object-contain w-full h-full transition-transform duration-300 hover:scale-105"
    />
  </div>
  <div className="p-4">
    <h3 className="text-lg font-semibold text-gray-800 mb-1">
      {gift.title}
    </h3>
    <p className="text-gray-500 text-sm mb-2 line-clamp-2">
      {gift.description || "No description available."}
    </p>
    <div className="flex items-center justify-between mt-3">
      <span className="text-blue-600 font-semibold">
        ${gift.price}
      </span>
      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
        {gift.category || "Other"}
      </span>
    </div>
  </div>
</div>

            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;
