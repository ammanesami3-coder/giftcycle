import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import api from "../services/api";
import { useUser } from "../context/UserContext";
import toast from "react-hot-toast";
import BuyerAddressForm from "../components/BuyerAddressForm";

/*
  OfferConversation.jsx
  - عرض حالة Swap/Sale + نزاعات + Refund
  - Socket للتحديث اللحظي
*/

const OfferConversation = () => {
  const { id } = useParams(); // offer_id
  const { user, loadingUser } = useUser();

  const [messages, setMessages] = useState([]);
  const [offer, setOffer] = useState(null);

  const [swapStatus, setSwapStatus] = useState("none");
  const [saleStatus, setSaleStatus] = useState("none");

  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);

  const [mainGift, setMainGift] = useState(null);
  const [swapGift, setSwapGift] = useState(null);

  // عرض تفاصيل الهدية في مودال
  const [selectedGift, setSelectedGift] = useState(null);
  const [selectedGiftRole, setSelectedGiftRole] = useState(null); // "requested" | "offered"

  // بيانات الشحن للتبادل (flow الجديد: quote + pay)
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [shippingForm, setShippingForm] = useState({
    name: "",
    address: "",
    weight: "",
  });
  const [shippingQuote, setShippingQuote] = useState(null);
  const [swapShipments, setSwapShipments] = useState([]);
  const [hasMySwapShipment, setHasMySwapShipment] = useState(false);
  const [partnerHasSwapShipment, setPartnerHasSwapShipment] = useState(false);

  // منطق البيع: عناوين المشتري والبائع
  const [showBuyerAddressModal, setShowBuyerAddressModal] = useState(false);
  const [showSellerAddressModal, setShowSellerAddressModal] = useState(false);

  // منطق البيع: اختيار أسعار الشحن + التلخيص
  const [shippingRates, setShippingRates] = useState([]);
  const [shippingRatesLoading, setShippingRatesLoading] = useState(false);
  const [showShippingRatesModal, setShowShippingRatesModal] = useState(false);
  const [saleSummary, setSaleSummary] = useState(null);

  // شحنة البيع (label + tracking)
  const [saleShipment, setSaleShipment] = useState(null);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const mountedRef = useRef(true);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const isSaleOffer = offer?.offer_type === "buy";

  const isBuyer = offer && user && user.id === offer.sender_id;
  const isSeller = offer && user && user.id === offer.owner_id;

  // من يستطيع تعديل عنوانه في صفحة المحادثة؟
  const canEditBuyerAddress =
    isSaleOffer &&
    isBuyer &&
    [
      "awaiting_shipping_selection",
      "awaiting_buyer_payment",
      "buyer_paid",
      "shipped",
      "sale_completed",
    ].includes(saleStatus);

  const canEditSellerAddress =
    isSaleOffer &&
    isSeller &&
    [
      "awaiting_shipping_selection",
      "awaiting_buyer_payment",
      "buyer_paid",
      "shipped",
      "sale_completed",
    ].includes(saleStatus);

  // قيم مشتقة لعرض تفاصيل عمولة الشحن للتبادل
  const shippingBaseAmount = shippingQuote?.rate?.base_amount ?? null;
  const shippingPlatformFee = shippingQuote?.rate?.platform_fee ?? null;
  const shippingFinalAmount =
    shippingQuote?.rate?.final_amount ?? shippingQuote?.rate?.amount ?? null;

  // تحميل الرسائل
  const loadMessages = async () => {
    try {
      const res = await api.get(`/offers/${id}/messages`);
      if (!mountedRef.current) return;
      setMessages(res.data || []);
      scrollToBottom();
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  // تحميل شحنات التبادل (swap_shipments)
  const loadSwapShipments = async () => {
    if (!user) return;
    try {
      const res = await api.get(`/swap/${id}/shipping`, {
        params: { user_id: user.id },
      });
      const rows = res.data || [];
      setSwapShipments(rows);

      const mine = rows.some((s) => s.sender_user_id === user.id);
      const partner = rows.some((s) => s.sender_user_id !== user.id);
      setHasMySwapShipment(mine);
      setPartnerHasSwapShipment(partner);
    } catch (err) {
      console.error("Failed to fetch swap shipments", err);
    }
  };

  // تحميل بيانات العرض + الهدايا + الرسائل
  useEffect(() => {
    mountedRef.current = true;
    const fetchData = async () => {
      try {
        const offerRes = await api.get(`/offers/single/${id}`);
        if (!mountedRef.current) return;

        const offerData = offerRes.data;
        setOffer(offerData);
        setSwapStatus(offerData?.swap_status || "none");
        setSaleStatus(offerData?.sale_status || "none");

        // تحميل الهدية الأصلية
        try {
          if (offerData.gift_id) {
            const giftRes = await api.get(`/gifts/${offerData.gift_id}`);
            if (mountedRef.current) setMainGift(giftRes.data);
          }
        } catch (err) {
          console.error("Failed to load main gift:", err);
        }

        // تحميل/تهيئة هدية التبادل
        try {
          if (offerData.swap_gift_id) {
            const swapRes = await api.get(`/gifts/${offerData.swap_gift_id}`);
            if (mountedRef.current) setSwapGift(swapRes.data);
          } else if (
            offerData.swap_gift_image_url ||
            offerData.swap_gift_title ||
            offerData.swap_gift_description
          ) {
            if (mountedRef.current) {
              setSwapGift({
                id: null,
                title: offerData.swap_gift_title || "Custom gift",
                description: offerData.swap_gift_description || "",
                image_url: offerData.swap_gift_image_url || "",
              });
            }
          }
        } catch (err) {
          console.error("Failed to load swap gift:", err);
        }

        // إذا كان هناك Swap نشط أو شحنات، حمّل شحنات التبادل
        if (
          offerData.offer_type !== "buy" &&
          ["protected_active", "shipping_partial", "shipping_created"].includes(
            offerData.swap_status
          )
        ) {
          await loadSwapShipments();
        }

        await loadMessages();
      } catch (err) {
        console.error(err);
        toast.error("Failed to load conversation.");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    if (!loadingUser && user) fetchData();

    return () => {
      mountedRef.current = false;
    };
  }, [id, loadingUser, user]);

  // Socket.io setup
  useEffect(() => {
    if (!user) return;

    const socket = io(
      process.env.REACT_APP_SOCKET_URL || "http://localhost:5000",
      {
        transports: ["websocket"],
        reconnectionAttempts: 5,
      }
    );
    socketRef.current = socket;

    socket.on("connect", () => {
      try {
        socket.emit("registerUser", String(user.id));
        if (id) socket.emit("joinOffer", id);
      } catch (e) {
        console.warn("Socket register error", e);
      }
    });

    socket.on("messageReceived", (msg) => {
      if (String(msg.offer_id) === String(id)) {
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();
      }
    });

    // إشعارات لحالات البيع/المبادلة والنزاعات
    socket.on("notificationReceived", (note) => {
      if (!note || !note.type) return;

      switch (note.type) {
        // منطق البيع
        case "sale_shipped":
          setSaleStatus("shipped");
          toast.success(note.message || "Seller marked the gift as shipped.");
          break;
        case "sale_payment_success_buyer":
          setSaleStatus("buyer_paid");
          toast.success(note.message || "Payment confirmed.");
          break;
        case "sale_payment_success_seller":
          setSaleStatus("buyer_paid");
          toast.success(
            note.message || "Buyer has paid. You can now ship the gift."
          );
          break;
        case "sale_delivered_confirmed":
          setSaleStatus("sale_completed");
          toast.success(note.message || "Delivery confirmed.");
          break;
        case "sale_label_ready":
          toast.success(
            note.message || "A shipping label is ready for this sale."
          );
          break;

        // فتح نزاع على عملية بيع
        case "dispute_opened":
          setSaleStatus("under_dispute");
          toast.error(note.message || "Sale is now under dispute.");
          break;
        case "sale_dispute_refunded_buyer":
          setSaleStatus("refunded");
          toast.success(
            note.message || "The dispute was resolved and payment refunded."
          );
          break;
        case "sale_dispute_rejected":
          setSaleStatus("sale_completed");
          toast(note.message || "The sale dispute was closed without refund.");
          break;

        // نزاعات المبادلة المحمية
        case "swap_dispute_opened":
          setSwapStatus("under_dispute");
          toast.error(note.message || "Swap is now under dispute.");
          break;
        case "swap_dispute_refunded_both":
          setSwapStatus("failed_swap");
          toast.success(
            note.message ||
              "Swap dispute resolved: fees refunded and swap marked as failed."
          );
          break;
        case "swap_dispute_rejected":
          setSwapStatus("protected_active");
          toast(note.message || "Swap dispute was rejected.");
          break;

        // شحنات التبادل
        case "swap_partner_label_created":
          setSwapStatus("shipping_partial");
          toast(note.message || "Your swap partner generated a shipping label.");
          loadSwapShipments();
          break;
        case "swap_shipping_ready":
          setSwapStatus("shipping_created");
          toast(note.message || "Both shipping labels are ready.");
          loadSwapShipments();
          break;

        case "offer_received":
          toast.success(note.message || "You received a new offer.");
          break;
        default:
          break;
      }
    });

    return () => {
      try {
        socket.off("messageReceived");
        socket.off("notificationReceived");
        socket.disconnect();
      } catch (_) {}
      socketRef.current = null;
    };
  }, [user, id]);

  // دالة مساعدة لتأكيد الدفع بعد الرجوع من Stripe
  const confirmSalePayment = async (sessionId) => {
    if (!user) return;

    try {
      setActionLoading(true);

      const res = await api.post(`/sale/${id}/confirm-payment`, {
        session_id: sessionId,
        user_id: user.id,
      });

      if (res.data?.sale_status) {
        setSaleStatus(res.data.sale_status);
      }

      toast.success(
        res.data?.message ||
          "Payment confirmed. Waiting for the seller to ship your gift."
      );
    } catch (err) {
      console.error("Confirm sale payment error:", err);
      toast.error(
        err?.response?.data?.error ||
          "Payment was processed, but we could not confirm it. Please contact support if this persists."
      );
    } finally {
      setActionLoading(false);
    }
  };

  // بعد الرجوع من Stripe، تأكيد الدفع وتحديث الحالة
  useEffect(() => {
    if (!user || !isSaleOffer) return;
    if (!isBuyer) return; // فقط المشتري

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const flow = params.get("flow");

    // إذا لم يكن هناك session_id أو لم يكن هذا فلو البيع نتوقف
    if (!sessionId || flow !== "sale") return;

    (async () => {
      await confirmSalePayment(sessionId);

      // تنظيف الـ URL من البارامترات حتى لا يُعاد الاستدعاء
      const url = new URL(window.location.href);
      url.searchParams.delete("session_id");
      url.searchParams.delete("flow");
      window.history.replaceState({}, "", url.toString());
    })();
  }, [user, isSaleOffer, isBuyer, id]);

  // إرسال رسالة جديدة
  const handleSend = async () => {
    if (!user) {
      toast.error("You must be logged in to send messages.");
      return;
    }
    if (newMessage.trim() === "") return;
    try {
      setActionLoading(true);
      const res = await api.post(`/offers/${id}/messages`, {
        sender_id: user.id,
        message: newMessage,
      });

      const msg = res.data;
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("newMessage", msg);
      } else {
        setMessages((prev) => [...prev, msg]);
      }

      setNewMessage("");
      scrollToBottom();
    } catch (err) {
      console.error(err);
      toast.error("Failed to send message.");
    } finally {
      setActionLoading(false);
    }
  };

  // تأكيد حذف رسالة
  const handleDeleteConfirm = (msg) => {
    setSelectedMsg(msg);
    setConfirmDelete(true);
  };

  const handleDeleteMessage = async () => {
    if (!selectedMsg) {
      setConfirmDelete(false);
      return;
    }
    if (!user) {
      toast.error("Not authorized.");
      setConfirmDelete(false);
      return;
    }
    try {
      setActionLoading(true);
      await api.delete(`/offers/${id}/messages/${selectedMsg.id}`, {
        data: { sender_id: user.id },
      });
      setMessages((prev) => prev.filter((m) => m.id !== selectedMsg.id));
      setConfirmDelete(false);
      toast.success("Message deleted successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete message");
    } finally {
      setActionLoading(false);
    }
  };

  // أفعال Swap
  const handleInitiateSwap = async () => {
    if (!user) return;
    try {
      setActionLoading(true);
      const res = await api.post(`/swap/${id}/initiate`, { user_id: user.id });
      toast.success(res.data.message || "Swap protection initiated.");
      setSwapStatus("awaiting_payment");
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.error || "Failed to initiate swap protection."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayProtection = async () => {
    if (!user) return;
    try {
      setActionLoading(true);
      const res = await api.post(`/swap/${id}/checkout`, { user_id: user.id });
      if (res.data?.url) window.location.href = res.data.url;
      else toast.error("Failed to redirect to payment.");
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.error || "Failed to create checkout session."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!user) return;
    try {
      setActionLoading(true);
      const res = await api.post(`/swap/${id}/complete`, { user_id: user.id });

      if (res.data?.swap_status) {
        setSwapStatus(res.data.swap_status);
      }

      if (res.data?.bothConfirmed) {
        toast.success(
          res.data.message || "Both users confirmed. Swap is now completed."
        );
      } else {
        toast.success(
          res.data.message ||
            "You confirmed receipt. Waiting for the other user."
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.error || "Failed to confirm swap completion."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkFailed = async () => {
    if (!user) return;

    const description = window.prompt(
      "Describe why this swap failed (e.g. not received, damaged, wrong item):",
      ""
    );
    if (!description) {
      return;
    }

    try {
      setActionLoading(true);

      // فتح Dispute للتبادل
      await api.post("/disputes", {
        deal_type: "swap_equal",
        deal_id: Number(id),
        opened_by: user.id,
        reason_code: "swap_failed",
        description,
      });

      // تحديث حالة التبادل إلى failed_swap
      const res = await api.post(`/swap/${id}/fail`, { user_id: user.id });

      toast.success(
        res.data?.message ||
          "Swap marked as failed and dispute has been opened for review."
      );
      setSwapStatus("failed_swap");
    } catch (err) {
      console.error("Swap fail / dispute error:", err);
      toast.error(
        err?.response?.data?.error ||
          "Failed to mark swap as failed or open a dispute."
      );
    } finally {
      setActionLoading(false);
    }
  };

  // أفعال البيع

  // فتح مودال أسعار الشحن للمشتري
  const handleOpenShippingRates = async () => {
    if (!user) return;
    if (!isBuyer) {
      toast.error("Only the buyer can select shipping.");
      return;
    }

    try {
      setShippingRates([]);
      setSaleSummary(null);
      setShippingRatesLoading(true);
      setShowShippingRatesModal(true);

      const res = await api.get(`/sale/${id}/shipping-rates`, {
        params: { user_id: user.id },
      });

      if (res.data?.rates?.length) {
        setShippingRates(res.data.rates);
        toast.success("Shipping options loaded. Choose one to continue.");
      } else {
        toast.error("No shipping rates available for this address.");
        setShowShippingRatesModal(false);
      }
    } catch (err) {
      console.error("Error loading shipping rates:", err);
      toast.error(
        err?.response?.data?.error || "Failed to load shipping rates."
      );
      setShowShippingRatesModal(false);
    } finally {
      setShippingRatesLoading(false);
    }
  };

  // اختيار rate معين
  const handleSelectShippingRate = async (rate) => {
    if (!user || !rate) return;

    try {
      setActionLoading(true);
      const res = await api.post(`/sale/${id}/select-rate`, {
        user_id: user.id,
        rate_id: rate.object_id,
        amount: rate.amount,
      });

      if (res.data?.sale_status) {
        setSaleStatus(res.data.sale_status);
      }
      if (res.data?.summary) {
        setSaleSummary(res.data.summary);
      }

      toast.success("Shipping option selected. You can now pay for this gift.");
      setShowShippingRatesModal(false);
    } catch (err) {
      console.error("Error selecting shipping rate:", err);
      toast.error(
        err?.response?.data?.error || "Failed to select shipping rate."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayForSale = async () => {
    if (!user) return;

    if (saleStatus === "awaiting_shipping_selection") {
      toast.error("Please choose a shipping option first.");
      return;
    }
    if (saleStatus !== "awaiting_buyer_payment") {
      toast.error("Sale is not ready for payment yet.");
      return;
    }

    try {
      setActionLoading(true);
      const res = await api.post(`/sale/${id}/checkout`, { user_id: user.id });
      if (res.data?.url) window.location.href = res.data.url;
      else toast.error("Failed to redirect to payment.");
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.error || "Failed to create sale checkout session."
      );
    } finally {
      setActionLoading(false);
    }
  };

  // توليد Shipping Label للبائع بعد الدفع (يدويًا بالزر فقط)
  const handleCreateSaleLabel = async () => {
    if (!user) return;
    if (!isSeller) {
      toast.error("Only the seller can generate a shipping label.");
      return;
    }

    if (saleStatus !== "buyer_paid" && saleStatus !== "shipped") {
      toast.error(
        "You can generate a shipping label only after the buyer has paid."
      );
      return;
    }

    try {
      setActionLoading(true);
      const res = await api.post(`/sale/${id}/create-label`, {
        user_id: user.id,
      });

      if (res.data?.shipment) {
        setSaleShipment(res.data.shipment);
      }

      toast.success(
        res.data?.message ||
          "Shipping label created. Download it and attach it to your package."
      );
    } catch (err) {
      console.error("Create sale label error:", err);
      toast.error(
        err?.response?.data?.error || "Failed to create shipping label."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkShipped = async () => {
    if (!user) return;
    if (!isSeller) {
      toast.error("Only the seller can mark as shipped.");
      return;
    }
    try {
      const tracking = window.prompt(
        "Enter tracking number (leave empty if you want to use the label tracking):",
        ""
      );
      const carrier = window.prompt(
        "Enter carrier (optional, leave empty to keep existing):",
        ""
      );
      setActionLoading(true);
      const res = await api.post(`/sale/${id}/mark-shipped`, {
        user_id: user.id,
        tracking_number: tracking || null,
        carrier: carrier || null,
      });
      if (res.data?.sale_status) setSaleStatus(res.data.sale_status);
      if (res.data?.shipment) setSaleShipment(res.data.shipment);
      toast.success(res.data.message || "Shipment marked as shipped.");
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.error || "Failed to mark shipment as shipped."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!user) return;
    if (!isBuyer) {
      toast.error("Only the buyer can confirm delivery.");
      return;
    }
    try {
      setActionLoading(true);
      const res = await api.post(`/sale/${id}/confirm-delivery`, {
        user_id: user.id,
      });
      if (res.data?.sale_status) setSaleStatus(res.data.sale_status);
      toast.success(res.data.message || "Delivery confirmed.");
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.error || "Failed to confirm delivery."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportIssue = async () => {
    if (!user) return;
    if (!isBuyer) {
      toast.error("Only the buyer can report an issue.");
      return;
    }

    const description = window.prompt(
      "Describe the issue (e.g., not received, damaged):",
      ""
    );
    if (!description) return;

    try {
      setActionLoading(true);

      const res = await api.post("/disputes", {
        deal_type: "sale",
        deal_id: Number(id),
        opened_by: user.id,
        reason_code: "reported_issue",
        description,
      });

      if (res.data) {
        setSaleStatus("under_dispute");
      }

      toast.success("Issue reported and dispute opened.");
    } catch (err) {
      console.error("Report issue error:", err);
      toast.error(err?.response?.data?.error || "Failed to report issue.");
    } finally {
      setActionLoading(false);
    }
  };

  // تغيّر حقول نموذج الشحن (Swap)
  const handleShippingInputChange = (e) => {
    const { name, value } = e.target;
    setShippingForm((prev) => ({ ...prev, [name]: value }));
  };

  // 1) طلب quote من Shippo – Swap
  const handleGetShippingQuote = async () => {
    if (!user) {
      toast.error("You must be logged in to get a shipping quote.");
      return;
    }
    if (!shippingForm.name || !shippingForm.address) {
      toast.error("Please fill in your name and address.");
      return;
    }

    try {
      setActionLoading(true);

      const street1 = shippingForm.address.slice(0, 50);

      const res = await api.post(`/swap/${id}/shipping/quote`, {
        user_id: user.id,
        from: {
          name: shippingForm.name,
          address_line1: street1,
        },
        to: {
          name: "Swap partner",
          address_line1: "Partner address",
        },
        parcel: {
          weight: Number(shippingForm.weight || 0.5),
        },
      });

      if (res.data?.rate) {
        setShippingQuote(res.data);
        toast.success("Shipping quote received.");
      } else {
        toast.error("No shipping quote returned for this swap.");
      }
    } catch (err) {
      console.error("Swap shipping quote error:", err);
      toast.error(
        err?.response?.data?.error ||
          "Failed to get shipping quote for this swap."
      );
    } finally {
      setActionLoading(false);
    }
  };

  // 2) دفع الشحن عبر Stripe – Swap
  const handlePayShipping = async () => {
    if (!user) return;
    if (!shippingQuote?.rate) {
      toast.error("No quote available. Please get a quote first.");
      return;
    }

    try {
      setActionLoading(true);
      const res = await api.post(`/swap/${id}/shipping/checkout`, {
        user_id: user.id,
        direction: isBuyer ? "buyer_to_owner" : "owner_to_buyer",
        rate_object_id: shippingQuote.rate.object_id,
        amount: shippingQuote.rate.amount,
        currency: shippingQuote.rate.currency || "usd",
      });

      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error("Failed to redirect to shipping payment.");
      }
    } catch (err) {
      console.error("Swap shipping checkout error:", err);
      toast.error(
        err?.response?.data?.error ||
          "Failed to create Stripe checkout for shipping."
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Badges

  const renderSwapStatusBadge = () => {
    switch (swapStatus) {
      case "awaiting_payment":
        return (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
            Swap protection pending – both users must pay.
          </span>
        );
      case "protected_active":
        return (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200">
            Protected swap active – you can safely exchange gifts.
          </span>
        );
      case "shipping_partial": {
        let text =
          "One shipping label is created. Waiting for the second one.";
        if (hasMySwapShipment && !partnerHasSwapShipment) {
          text =
            "Your shipping label is ready. Waiting for your swap partner to generate theirs.";
        } else if (!hasMySwapShipment && partnerHasSwapShipment) {
          text =
            "Your swap partner generated their label. You still need to generate yours.";
        }
        return (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200">
            {text}
          </span>
        );
      }
      case "shipping_created":
        return (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200">
            Shipping labels created – wait for both shipments.
          </span>
        );
      case "under_dispute":
        return (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200">
            Swap is currently under dispute.
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
            Swap completed.
          </span>
        );
      case "failed_swap":
        return (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200">
            Swap failed.
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            No swap protection enabled.
          </span>
        );
    }
  };

  const renderSaleStatusBadge = () => {
    switch (saleStatus) {
      case "awaiting_shipping_selection":
        return (
          <div className="flex flex-col items-center gap-1">
            <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
              Awaiting shipping selection.
            </span>
            {isBuyer && (
              <p className="text-xs text-blue-100/90">
                Choose a shipping option to continue.
              </p>
            )}
            {isSeller && (
              <p className="text-xs text-blue-100/90">
                Waiting for the buyer to choose a shipping option.
              </p>
            )}
          </div>
        );
      case "awaiting_buyer_payment":
        return (
          <div className="flex flex-col items-center gap-1">
            <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
              Awaiting buyer payment.
            </span>
            {isBuyer && (
              <p className="text-xs text-blue-100/90">
                You need to pay for this gift to proceed.
              </p>
            )}
            {isSeller && (
              <p className="text-xs text-blue-100/90">
                Waiting for the buyer to complete the payment.
              </p>
            )}
          </div>
        );
      case "buyer_paid":
        return (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200">
            {isBuyer
              ? "You have paid. Waiting for the seller to generate a label and ship your gift."
              : "Buyer has paid. Generate a shipping label and ship the gift."}
          </span>
        );
      case "shipped":
        return (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
            {isBuyer
              ? "Seller has shipped your gift."
              : "You marked the gift as shipped."}
          </span>
        );
      case "sale_completed":
        return (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-green-200 text-green-800 dark:bg-green-900/60 dark:text-green-200">
            Sale completed.
          </span>
        );
      case "under_dispute":
        return (
          <div className="flex flex-col items-center gap-1">
            <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200">
              Sale is currently under dispute.
            </span>
            <p className="text-xs text-blue-100/90">
              Our support team is reviewing this transaction.
            </p>
          </div>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
            {isBuyer
              ? "Sale refunded. You have been refunded."
              : "Sale refunded to the buyer."}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            No sale payment started yet.
          </span>
        );
    }
  };

  if (loadingUser || loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-300">Loading...</p>
      </div>
    );

  if (!user || !offer)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-red-600 dark:text-red-400">
          Unable to load conversation.
        </p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-6 px-3 sm:px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[calc(100vh-5rem)]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white px-4 sm:px-6 py-4 space-y-2 border-b border-blue-500/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-semibold">
                Conversation #{offer.id}
              </h2>
              <p className="text-xs sm:text-sm opacity-90">
                Offer for Gift ID:{" "}
                <span className="font-semibold">#{offer.gift_id}</span>
              </p>
              <p className="text-xs sm:text-sm opacity-90 capitalize">
                Mode:{" "}
                <span className="font-semibold">
                  {isSaleOffer ? "Sale (BUY request)" : "Swap (Exchange)"}
                </span>
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2 text-xs sm:text-sm">
              {isSaleOffer ? renderSaleStatusBadge() : renderSwapStatusBadge()}

              {/* أزرار عناوين الشحن (المشتري + البائع) */}
              {isSaleOffer && (canEditBuyerAddress || canEditSellerAddress) && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {canEditBuyerAddress && (
                    <button
                      type="button"
                      onClick={() => setShowBuyerAddressModal(true)}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] sm:text-xs font-medium border border-white/30"
                    >
                      Buyer delivery address
                    </button>
                  )}
                  {canEditSellerAddress && (
                    <button
                      type="button"
                      onClick={() => setShowSellerAddressModal(true)}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] sm:text-xs font-medium border border-white/30"
                    >
                      Seller shipping address
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Exchange details: الهدية الأصلية + هدية التبادل */}
          {(mainGift || swapGift) && (
            <div className="mt-3 bg-white/10 dark:bg-black/10 rounded-xl p-3 sm:p-4">
              <p className="text-xs sm:text-sm font-semibold mb-2 opacity-90">
                Exchange details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mainGift && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGift(mainGift);
                      setSelectedGiftRole("requested");
                    }}
                    className="bg-white/10 dark:bg-gray-900/40 rounded-lg p-2 sm:p-3 text-left cursor-pointer hover:bg-white/20 hover:shadow-lg transition-all duration-150 border border-white/10"
                  >
                    <p className="text-[11px] sm:text-xs font-semibold mb-1 opacity-80 flex items-center gap-1">
                      Gift requested
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/15">
                        Click to preview
                      </span>
                    </p>
                    <div className="flex gap-2 items-center">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-black/10 rounded-md overflow-hidden flex items-center justify-center">
                        <img
                          src={mainGift.image_url}
                          alt={mainGift.title}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm font-semibold line-clamp-2">
                          {mainGift.title}
                        </p>
                        <p className="text-[11px] sm:text-xs opacity-80">
                          ${mainGift.price}
                        </p>
                      </div>
                    </div>
                  </button>
                )}

                {swapGift && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGift(swapGift);
                      setSelectedGiftRole("offered");
                    }}
                    className="bg-white/10 dark:bg-gray-900/40 rounded-lg p-2 sm:p-3 text-left cursor-pointer hover:bg-white/20 hover:shadow-lg transition-all duration-150 border border-white/10"
                  >
                    <p className="text-[11px] sm:text-xs font-semibold mb-1 opacity-80 flex items-center gap-1">
                      Gift offered in exchange
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/15">
                        Click to preview
                      </span>
                    </p>
                    <div className="flex gap-2 items-center">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-black/10 rounded-md overflow-hidden flex items-center justify-center">
                        {swapGift.image_url ? (
                          <img
                            src={swapGift.image_url}
                            alt={swapGift.title || "Swap gift"}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-[11px] opacity-70">
                            No image
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm font-semibold line-clamp-2">
                          {swapGift.title || "Custom gift"}
                        </p>
                        {swapGift.description && (
                          <p className="text-[11px] sm:text-xs opacity-80 line-clamp-2">
                            {swapGift.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* روابط شحن التبادل */}
          {!isSaleOffer && (
            <div className="mt-3 bg-white/10 dark:bg-black/10 rounded-xl p-3 sm:p-4">
              <p className="text-xs sm:text-sm font-semibold mb-2 opacity-90">
                Your swap shipping label
              </p>

              {hasMySwapShipment ? (
                <div className="space-y-1">
                  {swapShipments
                    .filter((s) => s.sender_user_id === user.id)
                    .map((s) => (
                      <div
                        key={s.id}
                        className="text-[11px] sm:text-xs flex flex-wrap gap-2 items-center"
                      >
                        <span className="font-semibold">Your label:</span>
                        {s.label_url ? (
                          <a
                            href={s.label_url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            Download label
                          </a>
                        ) : (
                          <span>Label URL not available</span>
                        )}
                        {s.tracking_number && (
                          <span className="opacity-80">
                            | Tracking: {s.tracking_number}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-[11px] sm:text-xs opacity-80">
                  You do not have a shipping label yet for this swap.
                </p>
              )}

              {partnerHasSwapShipment && !hasMySwapShipment && (
                <p className="mt-2 text-[11px] sm:text-xs text-amber-100">
                  Your swap partner already generated their label. You still
                  need to generate yours.
                </p>
              )}
            </div>
          )}

          {/* روابط شحن البيع (label + tracking) */}
          {isSaleOffer && saleShipment && (
            <div className="mt-3 bg-white/10 dark:bg-black/10 rounded-xl p-3 sm:p-4">
              <p className="text-xs sm:text-sm font-semibold mb-2 opacity-90">
                Shipping label for this sale
              </p>
              <div className="text-[11px] sm:text-xs flex flex-wrap gap-2 items-center">
                {isSeller ? (
                  <span className="font-semibold">Your label:</span>
                ) : (
                  <span className="font-semibold">Seller&apos;s label:</span>
                )}
                {saleShipment.label_url ? (
                  <a
                    href={saleShipment.label_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Download label
                  </a>
                ) : (
                  <span>Label URL not available</span>
                )}
                {saleShipment.tracking_number && (
                  <span className="opacity-80">
                    | Tracking: {saleShipment.tracking_number}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* أزرار الأفعال */}
          <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-end text-xs">
            {isSaleOffer ? (
              <>
                {/* 1) المشتري يختار الشحن أولاً */}
                {saleStatus === "awaiting_shipping_selection" && isBuyer && (
                  <button
                    onClick={handleOpenShippingRates}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition disabled:opacity-60"
                  >
                    {shippingRatesLoading
                      ? "Loading shipping..."
                      : "Choose shipping option"}
                  </button>
                )}

                {/* 2) بعد اختيار الشحن → الدفع */}
                {saleStatus === "awaiting_buyer_payment" && isBuyer && (
                  <button
                    onClick={handlePayForSale}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition disabled:opacity-60"
                  >
                    {actionLoading ? "Redirecting..." : "Pay for this gift"}
                  </button>
                )}

                {/* 3) بعد الدفع: البائع يمكنه توليد label + تعليم الشحنة كمرسلة */}
                {saleStatus === "buyer_paid" && isSeller && (
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-end w-full">
                    <button
                      onClick={handleCreateSaleLabel}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition disabled:opacity-60"
                    >
                      {actionLoading
                        ? "Processing..."
                        : saleShipment
                        ? "Regenerate shipping label"
                        : "Generate shipping label"}
                    </button>
                    <button
                      onClick={handleMarkShipped}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition disabled:opacity-60"
                    >
                      {actionLoading ? "Saving..." : "Mark as Shipped"}
                    </button>
                  </div>
                )}

                {/* 4) بعد الشحن: المشتري يؤكد الاستلام أو يفتح مشكلة */}
                {saleStatus === "shipped" && isBuyer && (
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-end w-full">
                    <button
                      onClick={handleConfirmDelivery}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition disabled:opacity-60"
                    >
                      {actionLoading ? "Processing..." : "Confirm Received"}
                    </button>

                    <button
                      onClick={handleReportIssue}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition disabled:opacity-60"
                    >
                      Report Issue
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {(swapStatus === "none" || swapStatus === "pending_swap") && (
                  <button
                    onClick={handleInitiateSwap}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition disabled:opacity-60"
                  >
                    {actionLoading ? "Processing..." : "Enable Protected Swap"}
                  </button>
                )}

                {swapStatus === "awaiting_payment" && (
                  <button
                    onClick={handlePayProtection}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition disabled:opacity-60"
                  >
                    {actionLoading
                      ? "Redirecting..."
                      : "Pay Protection Fee ($1.49)"}
                  </button>
                )}

                {(swapStatus === "protected_active" ||
                  swapStatus === "shipping_partial") &&
                  !hasMySwapShipment && (
                    <button
                      onClick={() => {
                        setShippingQuote(null);
                        setShippingForm({ name: "", address: "", weight: "" });
                        setShowShippingModal(true);
                      }}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-medium transition disabled:opacity-60 flex items-center gap-1"
                    >
                      {actionLoading
                        ? "Processing..."
                        : partnerHasSwapShipment
                        ? "Generate my shipping label"
                        : "Get quote & pay shipping"}
                      <span className="text-lg">📦</span>
                    </button>
                  )}

                {swapStatus === "shipping_created" && (
                  <>
                    <button
                      onClick={handleMarkCompleted}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition disabled:opacity-60"
                    >
                      {actionLoading ? "Updating..." : "Mark Swap Completed"}
                    </button>
                    <button
                      onClick={handleMarkFailed}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition disabled:opacity-60"
                    >
                      {actionLoading ? "Updating..." : "Report Swap Failed"}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 bg-gray-50 dark:bg-gray-900">
          {messages.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center text-sm mt-6">
              No messages yet. Start the conversation.
            </p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${
                  msg.sender_id === user.id ? "justify-end" : "justify-start"
                }`}
              >
                {msg.sender_id !== user.id && (
                  <img
                    src={
                      msg.sender_avatar ||
                      "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                    }
                    alt="avatar"
                    className="w-8 h-8 rounded-full object-cover hidden xs:block"
                  />
                )}

                <div
                  className={`relative px-3 sm:px-4 py-2 rounded-2xl shadow text-xs sm:text-sm max-w-[80%] ${
                    msg.sender_id === user.id
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <p className="break-words">{msg.message}</p>
                  <span className="text-[10px] opacity-60 block mt-1">
                    {new Date(msg.created_at).toLocaleString()}
                  </span>

                  {msg.sender_id === user.id && (
                    <button
                      onClick={() => handleDeleteConfirm(msg)}
                      className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white text-[10px] rounded-full px-1"
                      title="Delete message"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {msg.sender_id === user.id && (
                  <img
                    src={
                      user.avatar_url ||
                      "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                    }
                    alt="your avatar"
                    className="w-8 h-8 rounded-full object-cover hidden xs:block"
                  />
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4 bg-white/90 dark:bg-gray-800/95 backdrop-blur flex gap-2">
          <input
            type="text"
            className="flex-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
          />
          <button
            onClick={handleSend}
            disabled={actionLoading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </div>

      {/* نافذة إدخال بيانات الشحن للتبادل (quote + pay) */}
      {showShippingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-7 relative">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => setShowShippingModal(false)}
              type="button"
            >
              ✕
            </button>

            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mb-1">
              Your shipping for this swap
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4">
              Enter your shipping details to get a real-time quote. You will pay
              only for your own label.
            </p>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="space-y-4 sm:space-y-5"
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Your full name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={shippingForm.name}
                    onChange={handleShippingInputChange}
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white px-3 py-2"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Your address
                  </label>
                  <textarea
                    name="address"
                    value={shippingForm.address}
                    onChange={handleShippingInputChange}
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white px-3 py-2"
                    rows={2}
                    placeholder="Street, City, Country"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Parcel weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    name="weight"
                    value={shippingForm.weight}
                    onChange={handleShippingInputChange}
                    className="w-32 text-sm rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white px-3 py-2"
                    placeholder="0.5"
                  />
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                    You can start with a test value, e.g. <strong>0.5</strong>{" "}
                    kg.
                  </p>
                </div>
              </div>

              {/* خطوة 1: الحصول على Quote */}
              {!shippingQuote && (
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowShippingModal(false)}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleGetShippingQuote}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-60"
                  >
                    {actionLoading ? "Requesting..." : "Get shipping quote"}
                  </button>
                </div>
              )}

              {/* خطوة 2: عرض Quote + زر الدفع */}
              {shippingQuote?.rate && (
                <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3 space-y-3">
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 text-xs sm:text-sm text-blue-900 dark:text-blue-100 space-y-1.5">
                    <p className="font-semibold">Estimated shipping cost</p>
                    <p>
                      Total you will pay:{" "}
                      <span className="font-semibold">
                        {shippingFinalAmount?.toFixed
                          ? shippingFinalAmount.toFixed(2)
                          : shippingQuote.rate.amount}{" "}
                        {shippingQuote.rate.currency}
                      </span>{" "}
                      via {shippingQuote.rate.provider}{" "}
                      {shippingQuote.rate.servicelevel_name
                        ? `(${shippingQuote.rate.servicelevel_name})`
                        : ""}
                    </p>

                    {(shippingBaseAmount != null ||
                      shippingPlatformFee != null) && (
                      <div className="mt-1.5 space-y-0.5 text-[11px] sm:text-xs opacity-90">
                        {shippingBaseAmount != null && (
                          <p>
                            Base carrier price:{" "}
                            <span className="font-medium">
                              {shippingBaseAmount.toFixed
                                ? shippingBaseAmount.toFixed(2)
                                : shippingBaseAmount}{" "}
                              {shippingQuote.rate.currency}
                            </span>
                          </p>
                        )}
                        {shippingPlatformFee != null && (
                          <p>
                            GiftCycle service fee:{" "}
                            <span className="font-medium">
                              {shippingPlatformFee.toFixed
                                ? shippingPlatformFee.toFixed(2)
                                : shippingPlatformFee}{" "}
                              {shippingQuote.rate.currency}
                            </span>
                          </p>
                        )}
                      </div>
                    )}

                    {shippingQuote.rate.est_days && (
                      <p className="opacity-80 mt-1">
                        Estimated {shippingQuote.rate.est_days} day(s)
                        delivery.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShippingQuote(null);
                      }}
                      className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Change details
                    </button>
                    <button
                      type="button"
                      onClick={handlePayShipping}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition disabled:opacity-60"
                    >
                      {actionLoading
                        ? "Redirecting..."
                        : "Pay & generate label"}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* مودال اختيار سعر الشحن في البيع */}
      {showShippingRatesModal && isSaleOffer && isBuyer && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 relative">
            <button
              type="button"
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full bg-black/5 p-1"
              onClick={() => setShowShippingRatesModal(false)}
            >
              ✕
            </button>

            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Choose a shipping option
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4">
              Select your preferred carrier and service. The final price will
              include shipping plus the GiftCycle service fee.
            </p>

            {shippingRatesLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-300">
                Loading shipping rates...
              </p>
            ) : shippingRates.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-300">
                No shipping options available for these addresses.
              </p>
            ) : (
              <div className="space-y-2">
                {shippingRates.map((rate) => (
                  <button
                    key={rate.object_id}
                    type="button"
                    onClick={() => handleSelectShippingRate(rate)}
                    disabled={actionLoading}
                    className="w-full text-left border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs sm:text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">
                        {rate.provider}{" "}
                        {rate.servicelevel_name || rate.service
                          ? `– ${rate.servicelevel_name || rate.service}`
                          : ""}
                      </span>
                      <span className="font-semibold">
                        ${Number(rate.amount).toFixed(2)} {rate.currency}
                      </span>
                    </div>
                    {rate.est_days && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        Estimated {rate.est_days} day(s) delivery
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* مودال عنوان المشتري في عملية البيع */}
      {showBuyerAddressModal && isSaleOffer && isBuyer && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 relative">
            <button
              type="button"
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full bg-black/5 p-1"
              onClick={() => setShowBuyerAddressModal(false)}
            >
              ✕
            </button>

            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Shipping address for this order
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4">
              This address will be used to generate the shipping label for your
              gift.
            </p>

            <BuyerAddressForm offerId={offer.id} addressRole="buyer" />
          </div>
        </div>
      )}

      {/* مودال عنوان البائع في عملية البيع */}
      {showSellerAddressModal && isSaleOffer && isSeller && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 relative">
            <button
              type="button"
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full bg-black/5 p-1"
              onClick={() => setShowSellerAddressModal(false)}
            >
              ✕
            </button>

            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Your shipping address for this gift
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4">
              This address will be used as the origin address on the shipping
              label when you ship the gift.
            </p>

            <BuyerAddressForm offerId={offer.id} addressRole="seller" />
          </div>
        </div>
      )}

      {/* مودال عرض تفاصيل الهدية */}
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
                    : "Gift offered in exchange"}
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
                    ? "This is the gift requested in this swap."
                    : "This is the gift your swap partner offers in exchange."}
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

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg w-full max-w-sm text-center">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              Delete Message?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mt-2 mb-4 text-sm">
              Are you sure you want to delete this message?
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMessage}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
              >
                {actionLoading ? "Processing..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfferConversation;
