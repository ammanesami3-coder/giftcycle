import React, { useState } from "react";
import { useUser } from "../context/UserContext";
import api from "../services/api";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

const Settings = () => {
  const { user, setUser } = useUser();

  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
  });

  const [avatar, setAvatar] = useState(user?.avatar_url || "");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ===============================
  // ✅ رفع الصورة إلى Cloudinary
  // ===============================
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "giftcycle_profile"); // Cloudinary preset name

    try {
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/duqriqurf/image/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();
      if (!data.secure_url) throw new Error("Upload failed");

      const imageUrl = data.secure_url;
      setAvatar(imageUrl);

      await api.put(`/users/${user.id}/avatar`, { avatar_url: imageUrl });

      const updatedUser = { ...user, avatar_url: imageUrl };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));

      toast.success("Profile picture updated successfully!");
    } catch (err) {
      toast.error("Image upload failed. Please check Cloudinary settings.");
    } finally {
      setUploading(false);
    }
  };

  // ===============================
  // ✅ تحديث بيانات الحساب
  // ===============================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData = { name: form.name, email: form.email };
      if (form.password.trim() !== "") {
        updateData.password = form.password;
      }

      const res = await api.put(`/users/${user.id}/update`, updateData);

      const updatedUser = {
        ...user,
        name: res.data.user.name,
        email: res.data.user.email,
      };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));

      toast.success("Account updated successfully!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  if (!user)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500 font-semibold">
          You must be logged in to access settings.
        </p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex justify-center items-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-8"
      >
        <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white mb-6">
          ⚙️ Account Settings
        </h2>

        {/* صورة البروفايل */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <img
              src={
                avatar ||
                "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
              }
              alt="Profile Avatar"
              className="w-32 h-32 rounded-full object-cover border-4 border-blue-500"
            />
            <label
              htmlFor="avatarUpload"
              className="absolute bottom-2 right-2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full cursor-pointer text-sm shadow"
            >
              {uploading ? "..." : "📷"}
              <input
                id="avatarUpload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            Click the camera to change your profile picture
          </p>
        </div>

        {/* نموذج تعديل البيانات */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">
              Full Name
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full border dark:border-gray-700 rounded-lg p-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full border dark:border-gray-700 rounded-lg p-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">
              New Password
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Leave empty to keep current password"
              className="w-full border dark:border-gray-700 rounded-lg p-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <motion.button
            type="submit"
            whileTap={{ scale: 0.97 }}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold shadow transition"
          >
            {loading ? "Updating..." : "Update Profile"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default Settings;
