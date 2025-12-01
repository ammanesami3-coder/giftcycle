// client/src/pages/SaleCancel.jsx
import React from "react";
import { Link } from "react-router-dom";

const SaleCancel = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
        <h2 className="text-xl font-semibold text-amber-600 dark:text-amber-400 mb-2">
          Payment cancelled
        </h2>
        <p className="text-gray-700 dark:text-gray-200 mb-4">
          You cancelled the payment. You can try again from the conversation
          page.
        </p>
        <Link
          to="/my-offers"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          Go to My Offers
        </Link>
      </div>
    </div>
  );
};

export default SaleCancel;
