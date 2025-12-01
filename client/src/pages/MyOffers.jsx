import React, { useEffect, useState } from "react";
import { getSentOffers } from "../services/api";
import api from "../services/api";
import { useUser } from "../context/UserContext";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  transports: ["websocket"],
  reconnectionAttempts: 5,
});

const getSwapMeta = (swap_status) => {
  switch (swap_status) {
    case "awaiting_payment":
      return {
        label: "Swap protection pending",
        desc: "Both users must pay the protection fee.",
        className:
          "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
      };
    case "protected_active":
      return {
        label: "Protected swap active",
        desc: "You can safely exchange gifts.",
        className:
          "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200",
      };
    case "shipping_created":
      return {
        label: "Shipping in progress",
        desc: "Shipping labels created. Waiting for both shipments.",
        className:
          "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200",
      };
    case "under_dispute":
      return {
        label: "Swap under dispute",
        desc: "Support is reviewing this protected swap.",
        className:
          "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200",
      };
    case "completed":
      return {
        label: "Swap completed",
        desc: "This exchange was completed.",
        className:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200",
      };
    case "failed_swap":
      return {
        label: "Swap failed",
        desc: "The protected swap did not complete.",
        className:
          "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200",
      };
    default:
      return {
        label: "No swap protection",
        desc: "This offer is not using protected swap.",
        className:
          "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
      };
  }
};

const getSaleMeta = (sale_status, isBuyOffer) => {
  if (!isBuyOffer) return null;

  switch (sale_status) {
    case "awaiting_buyer_payment":
      return {
        label: "Awaiting your payment",
        desc: "You need to pay for this gift to proceed.",
        className:
          "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
      };
    case "buyer_paid":
      return {
        label: "Payment completed",
        desc: "Waiting for the seller to ship your gift.",
        className:
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
      };
    case "shipped":
      return {
        label: "Shipped",
        desc: "Seller has shipped your gift.",
        className:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200",
      };
    case "sale_completed":
      return {
        label: "Sale completed",
        desc: "Delivery confirmed. This sale is finished successfully.",
        className:
          "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200",
      };
    case "under_dispute":
      return {
        label: "Under dispute",
        desc: "You opened a dispute for this sale. Support is reviewing it.",
        className:
          "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200",
      };
    case "refunded":
      return {
        label: "Refunded",
        desc: "Your dispute was resolved and you have been refunded.",
        className:
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
      };
    default:
      return {
        label: "No sale in progress",
        desc: "This offer is not in an active sale flow.",
        className:
          "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
      };
  }
};

const MyOffers = () => {
  const { user } = useUser();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  // معاينة الهدايا (نفس اسلوب OfferConversation)
  const [selectedGift, setSelectedGift] = useState(null);
  const [selectedGiftRole, setSelectedGiftRole] = useState(null); // "requested" | "offered"

  useEffect(() => {
    if (!user) return;

    getSentOffers(user.id)
      .then((data) => {
        setOffers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const handleOfferUpdated = async (payload) => {
      try {
        if (!payload?.offerId) return;
        const res = await api.get(`/offers/single/${payload.offerId}`);
        const updatedOffer = res.data;
        setOffers((prev) =>
          prev.map((o) =>
            String(o.id) === String(updatedOffer.id)
              ? { ...o, ...updatedOffer }
              : o
          )
        );
      } catch (err) {
        console.error("Failed to refresh offer after offerUpdated:", err);
      }
    };

    socket.on("offerUpdated", handleOfferUpdated);
    return () => {
      socket.off("offerUpdated", handleOfferUpdated);
    };
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-100 dark:bg-gray-900 transition">
        <p className="text-red-600 dark:text-red-400 text-lg font-semibold">
          You must be logged in to view your sent offers.
        </p>
      </div>
    );
  }

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 transition">
        <p className="text-gray-500 dark:text-gray-300">
          Loading your offers...
        </p>
      </div>
    );

  return (
    <>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-10 px-4 transition">
        <h1 className="text-2xl md:text-3xl font-semibold text-center mb-6 text-gray-800 dark:text-white">
          My Sent Offers
        </h1>

        {offers.length === 0 ? (
          <p className="text-center text-gray-600 dark:text-gray-400">
            You haven't sent any offers yet.
          </p>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {offers.map((offer) => {
              const swapMeta = getSwapMeta(offer.swap_status);
              const isBuyOffer = offer.offer_type === "buy";
              const saleMeta = getSaleMeta(offer.sale_status, isBuyOffer);

              return (
                <div
                  key={offer.id}
                  className="bg-white dark:bg-gray-800 shadow-md rounded-xl p-4 md:p-5 border border-gray-200 dark:border-gray-700 transition"
                >
                  {/* الصف العلوي: صورة الهدية الأساسية + العنوان + زر المحادثة */}
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedGift(() => {
                          setSelectedGiftRole("requested");
                          return {
                            title: offer.gift_title || "Gift",
                            image_url: offer.gift_image_url || "",
                            description: null,
                            price: offer.gift_price || null,
                          };
                        })
                      }
                      className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-500/70 hover:shadow-lg transition"
                    >
                      {offer.gift_image_url ? (
                        <img
                          src={offer.gift_image_url}
                          alt={offer.gift_title || "Gift"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                          No image
                        </div>
                      )}
                    </button>

                    <div className="flex-1">
                      <p className="text-gray-800 dark:text-gray-100 font-semibold">
                        Gift:{" "}
                        <Link
                          to={`/gift/${offer.gift_id}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {offer.gift_title || "View Gift"}
                        </Link>
                      </p>

                      <Link
                        to={`/offer/${offer.id}/chat`}
                        className="text-blue-600 dark:text-blue-400 underline mt-1 inline-block text-sm"
                      >
                        Open Chat
                      </Link>

                      <div className="mt-2">
                        <span
                          className={`inline-flex px-2 py-1 rounded text-xs md:text-sm text-white ${
                            isBuyOffer ? "bg-green-600" : "bg-yellow-600"
                          }`}
                        >
                          {offer.offer_type.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* رسالة العرض */}
                  <p className="mt-3 text-gray-600 dark:text-gray-300 text-sm md:text-base">
                    Message: {offer.message}
                  </p>

                  {/* كرت الهدية التي عرضتها في التبادل */}
                  {!isBuyOffer && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedGift(() => {
                          setSelectedGiftRole("offered");
                          if (offer.swap_gift_id && offer.swap_gift_title) {
                            return {
                              title: offer.swap_gift_title,
                              image_url: offer.swap_gift_image_url || "",
                              description:
                                "This is the gift you proposed to swap.",
                              price: offer.swap_gift_price || null,
                            };
                          }
                          return {
                            title: "Swap gift",
                            image_url: offer.swap_gift_image_url || "",
                            description: offer.swap_gift_title || "",
                            price: null,
                          };
                        })
                      }
                      className="mt-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-gray-50/60 dark:bg-gray-900/40 text-left w-full hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-900/20 transition"
                    >
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        You offered in exchange:
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100/70 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100">
                          Click to preview
                        </span>
                      </p>

                      {offer.swap_gift_id && offer.swap_gift_title ? (
                        <div className="mt-2 flex items-center gap-3">
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 flex-shrink-0">
                            {offer.swap_gift_image_url ? (
                              <img
                                src={offer.swap_gift_image_url}
                                alt={offer.swap_gift_title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[11px] text-gray-400">
                                No image
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                              {offer.swap_gift_title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              This is the gift you proposed to swap.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          (No image available for your swap gift.)
                        </p>
                      )}
                    </button>
                  )}

                  {/* حالة العرض */}
                  <p className="mt-3 text-sm font-semibold">
                    Status:{" "}
                    <span
                      className={
                        offer.status === "accepted"
                          ? "text-green-600"
                          : offer.status === "rejected"
                          ? "text-red-600"
                          : offer.status === "expired"
                          ? "text-gray-500 dark:text-gray-400"
                          : "text-yellow-600"
                      }
                    >
                      {offer.status}
                    </span>
                  </p>

                  {/* Sale block for BUY offers */}
                  {isBuyOffer && saleMeta && (
                    <div className="mt-3 text-sm">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${saleMeta.className}`}
                      >
                        {saleMeta.label}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {saleMeta.desc}
                      </p>
                    </div>
                  )}

                  {/* Swap block for non-buy offers */}
                  {!isBuyOffer && (
                    <div className="mt-3 text-sm">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${swapMeta.className}`}
                      >
                        {swapMeta.label}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {swapMeta.desc}
                      </p>
                    </div>
                  )}

                  <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm mt-2">
                    Sent at: {new Date(offer.created_at).toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* مودال معاينة الهدية */}
      {selectedGift && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative">
            <button
              type="button"
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full bg-black/5 p-1"
              onClick={() => {
                setSelectedGift(null);
                setSelectedGiftRole(null);
              }}
            >
              ✕
            </button>

            <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100">
                  {selectedGiftRole === "requested"
                    ? "Gift requested"
                    : "Gift you offered"}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Quick preview
                </span>
              </div>
              <div className="w-full h-60 sm:h-72 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center overflow-hidden mb-4">
                {selectedGift.image_url ? (
                  <img
                    src={selectedGift.image_url}
                    alt={selectedGift.title || "Gift preview"}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-gray-400">
                    No image available
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedGift.title || "Gift"}
                </h3>
                {selectedGift.price && (
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-300">
                    ${selectedGift.price}
                  </p>
                )}
                {selectedGift.description && (
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {selectedGift.description}
                  </p>
                )}
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                  {selectedGiftRole === "requested"
                    ? "This is the gift you requested in this offer."
                    : "This is the gift you offer in exchange."}
                </p>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-3.5 flex justify-end bg-gray-50 dark:bg-gray-900/80 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedGift(null);
                  setSelectedGiftRole(null);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750 transition"
              >
                Close preview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MyOffers;
