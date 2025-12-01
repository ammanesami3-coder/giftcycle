import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import { useUser } from "../context/UserContext";
import toast from "react-hot-toast";

const CLOUD_NAME = "duqriqurf";
const UPLOAD_PRESET = "giftcycle_unsigned";

const GiftDetails = () => {
  const { id } = useParams();
  const { user } = useUser();

  const [gift, setGift] = useState(null);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("");
  const [message, setMessage] = useState("");

  const [imageView, setImageView] = useState(false);

  // similar gifts
  const [similar, setSimilar] = useState([]);

  // share popup
  const [shareOpen, setShareOpen] = useState(false);

  // ===== تبادل: اختيار هدية/إنشاء هدية مخصّصة =====
  const [swapMode, setSwapMode] = useState("existing"); // existing | custom

  const [myGifts, setMyGifts] = useState([]);
  const [loadingMyGifts, setLoadingMyGifts] = useState(false);

  const [selectedSwapGiftId, setSelectedSwapGiftId] = useState("");

  const [customSwap, setCustomSwap] = useState({
    title: "",
    description: "",
    image_url: "",
  });
  const [uploadingSwapImage, setUploadingSwapImage] = useState(false);

  // Load gift + similar
  useEffect(() => {
    api
      .get(`/gifts/${id}`)
      .then((res) => {
        setGift(res.data);
        setLoading(false);

        api.get(`/gifts/similar/${id}`).then((s) => setSimilar(s.data));
      })
      .catch(() => setLoading(false));
  }, [id]);

  const loadMyGifts = async () => {
    if (!user) return;
    setLoadingMyGifts(true);
    try {
      const res = await api.get(`/gifts/my/${user.id}`);
      setMyGifts(res.data || []);
    } catch (err) {
      console.error("Error loading user gifts:", err);
      toast.error("Failed to load your gifts.");
    } finally {
      setLoadingMyGifts(false);
    }
  };

  const handleSwapModeChange = (mode) => {
    setSwapMode(mode);
  };

  const handleCustomSwapChange = (e) => {
    const { name, value } = e.target;
    setCustomSwap((prev) => ({ ...prev, [name]: value }));
  };

  const handleSwapImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingSwapImage(true);

    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", UPLOAD_PRESET);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: data,
        }
      );
      const json = await res.json();

      if (json.secure_url) {
        setCustomSwap((prev) => ({ ...prev, image_url: json.secure_url }));
      } else {
        toast.error("Image upload failed.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Image upload failed.");
    } finally {
      setUploadingSwapImage(false);
    }
  };

  const handleModalOpen = async (type) => {
    setModalType(type);
    setModalOpen(true);

    // عند فتح مودال التبادل، حمّل هدايا المستخدم
    if (type === "exchange" && user) {
      setSwapMode("existing");
      setSelectedSwapGiftId("");
      setCustomSwap({ title: "", description: "", image_url: "" });
      await loadMyGifts();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error("You must be logged in to send an offer.");
      return;
    }

    if (gift.gift_status === "locked") {
      toast.error("This gift is no longer available.");
      return;
    }

    if (user.id === gift.owner_id) {
      toast.error("You cannot send an offer to your own gift.");
      return;
    }

    // تحقق إضافي لعروض التبادل
    let payload = {
      gift_id: gift.id,
      offer_type: modalType,
      message,
      sender_id: user.id,
      owner_id: gift.owner_id,
    };

    if (modalType === "exchange") {
      if (swapMode === "existing") {
        if (!selectedSwapGiftId) {
          toast.error("Please select one of your gifts to swap with.");
          return;
        }
        payload.swap_gift_id = Number(selectedSwapGiftId);
      } else {
        // custom
        if (!customSwap.title || !customSwap.image_url) {
          toast.error("Please provide a title and image for your gift.");
          return;
        }
        payload.swap_gift_title = customSwap.title;
        payload.swap_gift_description = customSwap.description || "";
        payload.swap_gift_image_url = customSwap.image_url;
      }
    }

    try {
      await api.post("/offers", payload);

      setModalOpen(false);
      setMessage("");
      toast.success("Offer sent successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to send offer.");
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading gift...</p>
      </div>
    );

  if (!gift)
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-red-600">Gift not found.</p>
      </div>
    );

  const isOwner = user && user.id === gift.owner_id;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-10 px-4 flex flex-col items-center">
      {/* MAIN GRID */}
      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* IMAGE */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg relative">
          {gift.gift_status === "locked" && (
            <span className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded shadow text-sm">
              LOCKED
            </span>
          )}

          <img
            src={gift.image_url}
            alt={gift.title}
            onClick={() => setImageView(true)}
            className="w-full h-[400px] object-contain rounded-lg cursor-pointer hover:scale-105 transition"
          />

          <p className="text-center text-gray-500 mt-3 text-sm">
            Click image to zoom
          </p>
        </div>

        {/* DETAILS */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            {gift.title}
          </h1>

          <p className="mt-4 text-gray-600 dark:text-gray-300 leading-relaxed">
            {gift.description}
          </p>

          <div className="mt-5 flex items-center gap-4">
            <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              ${gift.price}
            </span>

            <span className="bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded text-gray-700 dark:text-gray-300 text-sm">
              {gift.category}
            </span>
          </div>

          {/* SHARE BUTTON */}
          <button
            onClick={() => setShareOpen(true)}
            className="mt-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            📤 Share
          </button>

          {/* STATUS MESSAGES */}
          {gift.gift_status === "locked" && (
            <p className="mt-6 text-red-600 font-semibold text-lg">
              This gift is no longer available.
            </p>
          )}

          {isOwner && (
            <p className="mt-6 text-blue-600 dark:text-blue-300 font-semibold text-lg">
              You own this gift.
            </p>
          )}

          {/* BUTTONS */}
          {!user ? (
            <Link
              to="/login"
              className="block mt-6 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg text-center font-semibold"
            >
              Login to send an offer
            </Link>
          ) : !isOwner && gift.gift_status !== "locked" ? (
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <button
                onClick={() => handleModalOpen("exchange")}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-lg font-semibold"
              >
                🔁 Exchange
              </button>

              <button
                onClick={() => handleModalOpen("buy")}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold"
              >
                💰 Buy
              </button>
            </div>
          ) : null}

          <Link
            to="/"
            className="block mt-6 text-center bg-gray-700 hover:bg-gray-800 text-white py-2 rounded-md"
          >
            ← Back to Gifts
          </Link>
        </div>
      </div>

      {/* SIMILAR */}
      <div className="max-w-6xl w-full mt-16">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text:white mb-4">
          Similar Gifts
        </h2>

        {similar.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            No similar gifts found.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {similar.map((item) => (
              <div
                key={item.id}
                onClick={() => (window.location.href = `/gift/${item.id}`)}
                className="bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-lg cursor-pointer overflow-hidden transition"
              >
                <div className="h-48 bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="object-contain w-full h-full hover:scale-105 transition"
                  />
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-blue-600 dark:text-blue-400 font-bold mt-1">
                    ${item.price}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FULLSCREEN IMAGE */}
      {imageView && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center cursor-pointer"
          onClick={() => setImageView(false)}
        >
          <img
            src={gift.image_url}
            alt=""
            className="max-w-[90%] max-h-[90%] object-contain"
          />
        </div>
      )}

      {/* SHARE POPUP */}
      {shareOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-center mb-4 dark:text-white">
              Share this Gift
            </h3>

            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied!");
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg mb-3"
            >
              🔗 Copy Link
            </button>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                window.location.href
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg mb-3 text-center"
            >
              💬 Share on WhatsApp
            </a>

            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                window.location.href
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-blue-800 hover:bg-blue-900 text-white py-2 rounded-lg text-center"
            >
              📘 Share on Facebook
            </a>

            <button
              onClick={() => setShareOpen(false)}
              className="mt-4 w-full bg-gray-300 dark:bg-gray-600 text-black dark:text-white py-2 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL: إرسال العرض */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4 text-center dark:text-white">
              {modalType === "buy"
                ? "💰 Send Purchase Request"
                : "🔁 Send Exchange Offer"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {modalType === "exchange" && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    What will you give in return?
                  </p>

                  {/* Switcher */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSwapModeChange("existing")}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                        swapMode === "existing"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      Use one of my gifts
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwapModeChange("custom")}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                        swapMode === "custom"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      Custom gift + image
                    </button>
                  </div>

                  {swapMode === "existing" && (
                    <div className="space-y-2">
                      {loadingMyGifts ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Loading your gifts...
                        </p>
                      ) : myGifts.length === 0 ? (
                        <p className="text-sm text-red-500">
                          You have no gifts posted yet. You can create a custom
                          gift with image.
                        </p>
                      ) : (
                        <>
                          <label className="text-sm text-gray-700 dark:text-gray-200">
                            Choose one of your gifts:
                          </label>
                          <select
                            className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded text-sm"
                            value={selectedSwapGiftId}
                            onChange={(e) =>
                              setSelectedSwapGiftId(e.target.value)
                            }
                          >
                            <option value="">-- Select a gift --</option>
                            {myGifts.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.title} (${g.price})
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  )}

                  {swapMode === "custom" && (
                    <div className="space-y-3">
                      <input
                        type="text"
                        name="title"
                        placeholder="Gift title"
                        value={customSwap.title}
                        onChange={handleCustomSwapChange}
                        className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded text-sm"
                      />

                      <textarea
                        name="description"
                        placeholder="Gift description (optional)"
                        value={customSwap.description}
                        onChange={handleCustomSwapChange}
                        rows="2"
                        className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded text-sm"
                      />

                      <div className="space-y-1">
                        <label className="block text-sm text-gray-700 dark:text-gray-200">
                          Upload image of your gift
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleSwapImageUpload}
                          className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded text-sm"
                        />
                        {uploadingSwapImage && (
                          <p className="text-xs text-blue-500">
                            Uploading image...
                          </p>
                        )}
                        {customSwap.image_url && (
                          <img
                            src={customSwap.image_url}
                            alt="swap gift"
                            className="mt-2 w-full h-32 object-contain rounded border border-gray-200 dark:border-gray-600"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <textarea
                className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text:white p-3 rounded"
                rows="4"
                placeholder="Write your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              ></textarea>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="bg-gray-300 dark:bg-gray-600 text-black dark:text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GiftDetails;
