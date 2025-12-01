import React, { useEffect, useState } from "react";
import { useUser } from "../context/UserContext";
import api, { deleteGift } from "../services/api";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

const MyGifts = () => {
  const { user } = useUser();
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedGift, setSelectedGift] = useState(null);

  // تحميل هدايا المستخدم
  useEffect(() => {
    if (!user) return;

    api
      .get(`/gifts/my/${user.id}`)
      .then((res) => {
        setGifts(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-100 dark:bg-gray-900 transition">
        <p className="text-red-600 dark:text-red-400 font-semibold text-lg">
          You must be logged in to view your gifts.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-100 dark:bg-gray-900 transition">
        <p className="text-gray-600 dark:text-gray-300">Loading your gifts...</p>
      </div>
    );
  }

  const openDeleteModal = (gift) => {
    if (gift.gift_status === "locked") {
      toast.error("You cannot delete a locked gift.");
      return;
    }
    setSelectedGift(gift);
    setConfirmDelete(true);
  };

  const confirmDeleteGift = async () => {
    try {
      await deleteGift(selectedGift.id);
      setGifts((prev) => prev.filter((g) => g.id !== selectedGift.id));
      toast.success("Gift deleted successfully!");
      setConfirmDelete(false);
      setSelectedGift(null);
    } catch (err) {
      toast.error("Failed to delete gift.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 px-4 py-10 transition">
      <h1 className="text-2xl font-semibold text-center mb-6 text-gray-800 dark:text-white">
        My Gifts
      </h1>

      {gifts.length === 0 ? (
        <p className="text-center text-gray-600 dark:text-gray-400 text-lg">
          You haven't added any gifts yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {gifts.map((gift) => (
            <div
              key={gift.id}
              className="bg-white dark:bg-gray-800 shadow-md rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition"
            >
              {/* صورة الهدية */}
              <div className="relative h-48 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                {gift.gift_status === "locked" && (
                  <span className="absolute top-3 right-3 bg-red-600 text-white px-2 py-1 text-xs rounded shadow">
                    LOCKED
                  </span>
                )}
                <img
                  src={gift.image_url}
                  alt={gift.title}
                  className="object-contain h-full w-full"
                />
              </div>

              {/* التفاصيل */}
              <div className="p-4">
                <h2 className="font-semibold text-lg text-gray-800 dark:text-gray-100">
                  {gift.title}
                </h2>
                <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                  {gift.description.slice(0, 60)}...
                </p>

                <div className="flex justify-between items-center mt-4">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    ${gift.price}
                  </span>
                  <span className="text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 px-2 py-1 rounded">
                    {gift.category}
                  </span>
                </div>

                {/* الأزرار */}
                <div className="flex gap-3 mt-4">
                  <Link
                    to={`/gift/${gift.id}`}
                    className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition"
                  >
                    View Details
                  </Link>

                  <button
                    onClick={() => openDeleteModal(gift)}
                    className="flex-1 text-center bg-red-600 hover:bg-red-700 text-white py-2 rounded transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg w-full max-w-sm text-center transition">
            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-white">
              Delete Gift?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Are you sure you want to delete
              <span className="font-bold"> "{selectedGift?.title}"</span>?
            </p>

            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>

              <button
                onClick={confirmDeleteGift}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyGifts;
