import React, { useEffect, useState } from "react";
import api from "../services/api";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const Home = () => {
  const [gifts, setGifts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [priceFilter, setPriceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [availableOnly, setAvailableOnly] = useState(false);

  useEffect(() => {
    api
      .get("/gifts")
      .then((res) => {
        setGifts(res.data);
        setFiltered(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const categories = ["All", ...new Set(gifts.map((g) => g.category || "Other"))];

  useEffect(() => {
    let data = [...gifts];

    if (availableOnly) data = data.filter((g) => g.gift_status !== "locked");

    if (search.trim() !== "") {
      data = data.filter(
        (g) =>
          g.title.toLowerCase().includes(search.toLowerCase()) ||
          g.description?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (categoryFilter !== "All") {
      data = data.filter((g) => g.category === categoryFilter);
    }

    if (priceFilter === "under20") data = data.filter((g) => g.price <= 20);
    if (priceFilter === "20to50") data = data.filter((g) => g.price > 20 && g.price <= 50);
    if (priceFilter === "50plus") data = data.filter((g) => g.price > 50);

    if (sortBy === "newest") {
      data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortBy === "low") {
      data.sort((a, b) => a.price - b.price);
    } else if (sortBy === "high") {
      data.sort((a, b) => b.price - a.price);
    }

    setFiltered(data);
  }, [search, categoryFilter, priceFilter, sortBy, availableOnly, gifts]);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-300 text-lg">Loading gifts...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 dark:text-white transition">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm py-4 mb-6 transition">
        <h1 className="text-center text-3xl font-semibold text-gray-800 dark:text-white">
          🎁 GiftCycle Marketplace
        </h1>
        <p className="text-center text-gray-500 dark:text-gray-300 mt-1">
          Exchange, sell, or find your next gift!
        </p>
      </header>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-4 flex gap-6">
        {/* Sidebar */}
        <aside className="w-full sm:w-64 bg-white dark:bg-gray-800 rounded-xl shadow p-5 h-fit transition">
          <h2 className="text-lg font-semibold mb-3">Filters</h2>

          <input
            type="text"
            placeholder="Search..."
            className="w-full border p-2 rounded mb-4 dark:bg-gray-700 dark:border-gray-600"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Category */}
          <h3 className="text-sm font-semibold mb-2">Category</h3>
          <select
            className="w-full p-2 border rounded mb-4 dark:bg-gray-700 dark:border-gray-600"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          {/* Price */}
          <h3 className="text-sm font-semibold mb-2">Price</h3>
          <select
            className="w-full p-2 border rounded mb-4 dark:bg-gray-700 dark:border-gray-600"
            value={priceFilter}
            onChange={(e) => setPriceFilter(e.target.value)}
          >
            <option value="all">All prices</option>
            <option value="under20">Under $20</option>
            <option value="20to50">$20 - $50</option>
            <option value="50plus">$50 +</option>
          </select>

          {/* Sorting */}
          <h3 className="text-sm font-semibold mb-2">Sort by</h3>
          <select
            className="w-full p-2 border rounded mb-4 dark:bg-gray-700 dark:border-gray-600"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="low">Price: Low to High</option>
            <option value="high">Price: High to Low</option>
          </select>

          {/* Available Only */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={() => setAvailableOnly(!availableOnly)}
            />
            <span className="text-sm">Available Only</span>
          </label>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-300 mt-10">
              No gifts match your filters.
            </p>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
            >
              {filtered.map((gift) => (
                <motion.div
                  key={gift.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  whileHover={{ scale: 1.03 }}
                >
                  <Link
                    to={`/gift/${gift.id}`}
                    className="block bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden 
                               cursor-pointer relative transition hover:shadow-lg"
                  >
                    {gift.gift_status === "locked" && (
                      <span className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded shadow">
                        LOCKED
                      </span>
                    )}

                    <div className="w-full h-56 bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                      <img
                        src={gift.image_url}
                        alt={gift.title}
                        className="object-contain w-full h-full transition-transform duration-300 hover:scale-105"
                      />
                    </div>

                    <div className="p-4">
                      <h3 className="text-lg font-semibold mb-1">{gift.title}</h3>
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-2 line-clamp-2">
                        {gift.description}
                      </p>

                      <div className="flex items-center justify-between mt-3">
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">
                          ${gift.price}
                        </span>
                        <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                          {gift.category}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Home;
