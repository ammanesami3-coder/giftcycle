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
    image_url: "",
    parcel_weight_kg: "", // 👈 وزن الطرد بالكيلو
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Cloudinary credentials
  const CLOUD_NAME = "duqriqurf";
  const UPLOAD_PRESET = "giftcycle_unsigned";

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", UPLOAD_PRESET);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: data,
        }
      );
      const json = await res.json();

      if (json.secure_url) {
        setForm((prev) => ({ ...prev, image_url: json.secure_url }));
      }
    } catch (err) {
      alert("❌ Image upload failed.");
      console.error(err);
    }
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) {
        alert("You must be logged in to add a gift.");
        return;
      }

      // 👈 نرسل الوزن كرقم parcel_weight_kg
      await api.post("/gifts", {
        title: form.title,
        description: form.description,
        price: form.price,
        category: form.category,
        image_url: form.image_url,
        parcel_weight_kg: Number(form.parcel_weight_kg),
        owner_id: user.id,
      });

      alert("🎁 Gift added successfully!");
      setForm({
        title: "",
        description: "",
        price: "",
        category: "",
        image_url: "",
        parcel_weight_kg: "",
      });
    } catch (err) {
      alert("❌ Error adding gift.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 transition">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-semibold text-center mb-6 text-gray-700 dark:text-gray-100">
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
            className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-700 dark:text-white"
          />

          <textarea
            name="description"
            placeholder="Description"
            value={form.description}
            onChange={handleChange}
            rows="3"
            className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-700 dark:text-white"
          />

          <input
            type="number"
            name="price"
            placeholder="Price ($)"
            value={form.price}
            onChange={handleChange}
            required
            className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-700 dark:text-white"
          />

          {/* 👇 حقل وزن الطرد بالكيلوغرام */}
          <div>
            <label className="block mb-1 text-gray-600 dark:text-gray-300 text-sm">
              Parcel weight (kg)
            </label>
            <input
              type="number"
              name="parcel_weight_kg"
              step="0.1"
              min="0.1"
              placeholder="e.g. 0.5"
              value={form.parcel_weight_kg}
              onChange={handleChange}
              required
              className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Approximate weight of the packaged gift in kilograms.
            </p>
          </div>

          <input
            type="text"
            name="category"
            placeholder="Category"
            value={form.category}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-700 dark:text-white"
          />

          <div>
            <label className="block mb-1 text-gray-600 dark:text-gray-300">
              Upload Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>

          {uploading && (
            <p className="text-blue-600 dark:text-blue-400 text-sm text-center">
              Uploading image...
            </p>
          )}

          <input
            type="text"
            name="image_url"
            placeholder="Image URL"
            value={form.image_url}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-700 dark:text-white"
          />

          <button
            type="submit"
            disabled={loading || uploading}
            className={`w-full py-3 rounded-lg text-white font-medium transition ${
              loading || uploading
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
