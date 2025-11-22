import React, { useEffect, useState } from "react";
import api from "../services/api";
import { useUser } from "../context/UserContext";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Link } from "react-router-dom"; // تأكد من وجود هذا في الأعلى

const CLOUD_NAME = "duqriqurf"; // ضع اسم Cloudinary الصحيح هنا
const UPLOAD_PRESET = "giftcycle_unsigned"; // تأكد أنه Unsigned

const Profile = () => {
  const { user, setUser } = useUser();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // جلب الإحصائيات
  useEffect(() => {
    if (!user) return;
    api
      .get(`/users/${user.id}/stats`)
      .then((res) => {
        setStats(res.data);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load profile stats");
        setLoading(false);
      });
  }, [user]);

  // رفع صورة جديدة للبروفايل
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    try {
      // رفع الصورة إلى Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);

      const uploadRes = await fetch(
  `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
  {
    method: "POST",
    body: formData,
  }
);


      const uploadData = await uploadRes.json();
      if (!uploadData.secure_url) throw new Error("Cloudinary upload failed");

      const imageUrl = uploadData.secure_url;

      // تحديث الصورة في قاعدة البيانات
      await api.put(`/users/${user.id}/avatar`, { avatar_url: imageUrl });

      // تحديث حالة المستخدم محليًا
      const updatedUser = { ...user, avatar_url: imageUrl };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));

      toast.success("Profile picture updated!");
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Please check Cloudinary settings.");
    } finally {
      setUploading(false);
    }
  };

  if (!user)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500 text-lg font-semibold">
          You must be logged in to view your profile.
        </p>
      </div>
    );

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading profile...
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-12 px-6 flex justify-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-3xl w-full p-8"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
          <div className="relative">
            <img
              src={
                user.avatar_url ||
                "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
              }
              alt="User Avatar"
              className="w-32 h-32 rounded-full object-cover border-4 border-blue-500"
            />
            <label
              htmlFor="avatarUpload"
              className="absolute bottom-2 right-2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full cursor-pointer"
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

          <div className="text-center md:text-left">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
              {user.name}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">{user.email}</p>
            <p className="mt-2 text-sm text-blue-600 dark:text-blue-400 font-medium">
              Member since:{" "}
              {new Date(user.created_at).toLocaleDateString("en-US")}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
  <motion.div
    whileHover={{ scale: 1.05 }}
    className="bg-blue-100 dark:bg-blue-900 p-4 rounded-lg text-center"
  >
    <h3 className="text-2xl font-bold text-blue-700 dark:text-blue-400">
      {stats.gifts || 0}
    </h3>
    <p className="text-gray-700 dark:text-gray-200 text-sm">
      Gifts Added
    </p>
  </motion.div>

  <motion.div
    whileHover={{ scale: 1.05 }}
    className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg text-center"
  >
    <h3 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
      {stats.sent || 0}
    </h3>
    <p className="text-gray-700 dark:text-gray-200 text-sm">
      Offers Sent
    </p>
  </motion.div>

  <motion.div
    whileHover={{ scale: 1.05 }}
    className="bg-green-100 dark:bg-green-900 p-4 rounded-lg text-center"
  >
    <h3 className="text-2xl font-bold text-green-700 dark:text-green-400">
      {stats.received || 0}
    </h3>
    <p className="text-gray-700 dark:text-gray-200 text-sm">
      Offers Received
    </p>
  </motion.div>

  <motion.div
    whileHover={{ scale: 1.05 }}
    className="bg-purple-100 dark:bg-purple-900 p-4 rounded-lg text-center"
  >
    <h3 className="text-2xl font-bold text-purple-700 dark:text-purple-400">
      {stats.accepted || 0}
    </h3>
    <p className="text-gray-700 dark:text-gray-200 text-sm">
      Accepted Offers
    </p>
  </motion.div>
</div>


        {/* Quick Links */}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <motion.div whileHover={{ scale: 1.03 }}>
    <Link
      to="/my-gifts"
      className="block bg-blue-600 hover:bg-blue-700 text-white text-center py-3 rounded-lg font-semibold transition"
    >
      🎁 My Gifts
    </Link>
  </motion.div>

  <motion.div whileHover={{ scale: 1.03 }}>
    <Link
      to="/my-offers"
      className="block bg-yellow-500 hover:bg-yellow-600 text-white text-center py-3 rounded-lg font-semibold transition"
    >
      ✉️ My Offers
    </Link>
  </motion.div>

  <motion.div whileHover={{ scale: 1.03 }}>
    <Link
      to="/offers-received"
      className="block bg-green-600 hover:bg-green-700 text-white text-center py-3 rounded-lg font-semibold transition"
    >
      📬 Offers Received
    </Link>
  </motion.div>

  <motion.div whileHover={{ scale: 1.03 }}>
    <Link
      to="/settings"
      className="block bg-gray-700 hover:bg-gray-800 text-white text-center py-3 rounded-lg font-semibold transition"
    >
      ⚙️ Settings
    </Link>
  </motion.div>
</div>

      </motion.div>
    </div>
  );
};

export default Profile;
