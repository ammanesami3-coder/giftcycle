import React from "react";
import { useNavigate } from "react-router-dom";

const SwapCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center max-w-md w-full">
        <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-3">
          Payment Cancelled
        </h2>

        <p className="text-gray-700 dark:text-gray-300 mb-6">
          You cancelled the payment process.  
          Swap protection has not been activated yet.
        </p>

        <button
          onClick={() => navigate(-1)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
        >
          Go Back
        </button>
      </div>
    </div>
  );
};

export default SwapCancel;
