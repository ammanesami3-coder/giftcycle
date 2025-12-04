import React, { useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import { useUser } from "../context/UserContext";

export default function BuyerAddressForm({ offerId }) {
  const { user } = useUser();

  const [form, setForm] = useState({
    fullname: "",
    address: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error("You must be logged in to save your address.");
      return;
    }

    setLoading(true);
    try {
      await api.post(`/sale/${offerId}/buyer-address`, {
        user_id: user.id,
        fullname: form.fullname,
        address: form.address,
        address2: form.address2 || null,
        city: form.city,
        state: form.state,
        zip: form.zip,
      });

      toast.success("Address saved successfully. Seller can now see it.");
    } catch (err) {
      console.error("BuyerAddressForm error:", err);
      toast.error(
        err?.response?.data?.message || "Failed to save address. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="
        mt-2
        bg-black/10 dark:bg-black/30
        border border-white/15
        rounded-2xl
        px-4 py-3 sm:px-5 sm:py-4
        max-w-xl mx-auto
        space-y-3
      "
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-50 text-sm sm:text-base">
            Shipping address for this order
          </h3>
          <p className="text-[11px] sm:text-xs text-blue-100/80 mt-0.5">
            This address will be used to generate the shipping label for your gift.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <input
            type="text"
            name="fullname"
            value={form.fullname}
            onChange={handleChange}
            placeholder="Full name"
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-500/50 bg-gray-900/60 text-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="sm:col-span-2">
          <input
            type="text"
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="Address line 1"
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-500/50 bg-gray-900/60 text-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="sm:col-span-2">
          <input
            type="text"
            name="address2"
            value={form.address2}
            onChange={handleChange}
            placeholder="Address line 2 (optional)"
            className="w-full px-3 py-2 rounded-lg border border-gray-500/50 bg-gray-900/60 text-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <input
            type="text"
            name="city"
            value={form.city}
            onChange={handleChange}
            placeholder="City"
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-500/50 bg-gray-900/60 text-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <input
            type="text"
            name="state"
            value={form.state}
            onChange={handleChange}
            placeholder="State"
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-500/50 bg-gray-900/60 text-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="sm:col-span-2 sm:max-w-xs">
          <input
            type="text"
            name="zip"
            value={form.zip}
            onChange={handleChange}
            placeholder="ZIP / Postal code"
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-500/50 bg-gray-900/60 text-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-medium transition disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save shipping address"}
        </button>
      </div>
    </form>
  );
}
