import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser } from "../services/api";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

const Register = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await registerUser(form);
      toast.success("Account created successfully!");
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full"
      >
        <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white mb-2">
          Create Account 🎉
        </h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-6">
          Join GiftCycle and start sharing joy
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border dark:border-gray-600 dark:bg-gray-700 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />

          <input
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border dark:border-gray-600 dark:bg-gray-700 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full border dark:border-gray-600 dark:bg-gray-700 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 dark:text-blue-400 font-semibold">
            Login
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Register;
