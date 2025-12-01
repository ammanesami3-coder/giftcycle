import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser } from "../services/api";
import { useUser } from "../context/UserContext";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

const Login = () => {
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await loginUser(form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      setUser(res.data.user);
      toast.success("Welcome back!");
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
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
          Welcome Back 👋
        </h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-6">
          Sign in to continue your GiftCycle journey
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          Don't have an account?{" "}
          <Link to="/register" className="text-blue-600 dark:text-blue-400 font-semibold">
            Register
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
