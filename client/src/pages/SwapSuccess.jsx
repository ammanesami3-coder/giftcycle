import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";

const SwapSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const offer_id = searchParams.get("offer_id");

    if (!sessionId || !offer_id) {
      toast.error("Invalid payment confirmation.");
      navigate("/");
      return;
    }

    const confirmPayment = async () => {
      try {
        const res = await api.post("/swap/confirm", {
          session_id: sessionId,
          offer_id,
        });

        toast.success(res.data.message);
        navigate(`/offer/${offer_id}/chat`);
      } catch (err) {
        console.error(err);
        toast.error("Failed to confirm payment.");
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    confirmPayment();
  }, []);

  return (
    <div className="min-h-screen flex justify-center items-center bg-gray-100 dark:bg-gray-900">
      <p className="text-gray-800 dark:text-gray-200 text-lg">
        Processing your secure swap…
      </p>
    </div>
  );
};

export default SwapSuccess;
