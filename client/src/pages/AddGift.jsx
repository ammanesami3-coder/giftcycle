import React, { useState } from "react";
import api from "../services/api";
import { useUser } from "../context/UserContext";

const AddGift = () => {
  const { user } = useUser();

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    image_url: ""
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("You must be logged in to add a gift.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/gifts", {
        ...form,
        owner_id: user.id  // ✔ أهم سطر
      });

      alert("🎁 Gift added successfully!");

      setForm({
        title: "",
        description: "",
        price: "",
        category: "",
        image_url: ""
      });

    } catch (err) {
      console.error(err);
      alert("❌ Error adding gift.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-semibold text-center mb-6 text-gray-700">
          Add a New Gift 🎁
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">

          <input
            type="text"
            name="title"
            placeholder="Gift Title"
            value={form.title}
            onChange={handleChange}
            required
            className="w-full p-3 border border-gray-300 rounded-lg"
          />

          <textarea
            name="description"
            placeholder="Description"
            value={form.description}
            onChange={handleChange}
            rows="3"
            className="w-full p-3 border border-gray-300 rounded-lg"
          />

          <input
            type="number"
            name="price"
            placeholder="Price ($)"
            value={form.price}
            onChange={handleChange}
            required
            className="w-full p-3 border border-gray-300 rounded-lg"
          />

          <input
            type="text"
            name="category"
            placeholder="Category"
            value={form.category}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />

          <input
            type="text"
            name="image_url"
            placeholder="Image URL"
            value={form.image_url}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-medium transition ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Adding..." : "Add Gift"}
          </button>

        </form>
      </div>
    </div>
  );
};

export default AddGift;
