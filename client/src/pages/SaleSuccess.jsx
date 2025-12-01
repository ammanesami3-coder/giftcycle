import React, { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const SaleSuccess = () => {
  const query = useQuery();
  const sessionId = query.get("session_id");

  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const confirm = async () => {
      try {
        const res = await api.post("/sale/confirm", { session_id: sessionId });
        setStatus("success");
        setMessage(
          res.data.message ||
            "Payment confirmed. Waiting for the seller to ship your gift."
        );
        toast.success("Payment confirmed.");
      } catch (err) {
        console.error(err);
        setStatus("error");
        setMessage(
          err.response?.data?.error ||
            "Failed to confirm payment. Please contact support."
        );
        toast.error("Failed to confirm payment.");
      }
    };

    if (sessionId) confirm();
    else {
      setStatus("error");
      setMessage("Missing session_id in URL.");
    }
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
        {status === "loading" && (
          <p className="text-gray-700 dark:text-gray-200">
            Confirming your payment...
          </p>
        )}
        {status === "success" && (
          <>
            <h2 className="text-xl font-semibold text-green-600 dark:text-green-400 mb-2">
              Payment Successful
            </h2>
            <p className="text-gray-700 dark:text-gray-200 mb-4">{message}</p>
            <Link
              to="/my-offers"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
              Go to My Offers
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
              Payment Error
            </h2>
            <p className="text-gray-700 dark:text-gray-200 mb-4">{message}</p>
            <Link
              to="/"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
              Back to Home
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default SaleSuccess;
