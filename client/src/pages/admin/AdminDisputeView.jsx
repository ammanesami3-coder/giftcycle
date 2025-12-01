// client/src/pages/admin/AdminDisputeView.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useUser } from "../../context/UserContext";
import api from "../../services/api";
import toast from "react-hot-toast";
import ConfirmDialog from "../../components/ConfirmDialog";

const AdminDisputeView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();

  const [dispute, setDispute] = useState(null);
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");

  // حالة مودال التأكيد
  const [confirmState, setConfirmState] = useState({
    open: false,
    action: null,
  });

  const isAdmin = Boolean(user?.is_admin);

  useEffect(() => {
    if (!user || !isAdmin) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const dispRes = await api.get(`/disputes/${id}`);
        setDispute(dispRes.data);

        const dealId = dispRes.data.deal_id;
        const offerRes = await api.get(`/offers/single/${dealId}`);
        setOffer(offerRes.data);
      } catch (err) {
        console.error("Failed to load dispute:", err);
        toast.error("Failed to load dispute data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user, isAdmin]);

  // فتح مودال التأكيد مع نوع الإجراء
  const handleResolveClick = (action) => {
    if (!dispute || dispute.status !== "open") {
      toast.error("This dispute is already resolved.");
      return;
    }
    setConfirmState({ open: true, action });
  };

  // تنفيذ طلب الحل فعليًا (بدون confirm)
  const resolveDispute = async (action) => {
    if (!dispute || !user || !isAdmin) {
      toast.error("You are not authorized.");
      return;
    }
    if (dispute.status !== "open") {
      toast.error("This dispute is already resolved.");
      return;
    }

    try {
      setResolving(true);
      const body = {
        action,
        admin_id: user.id,
        resolution_note: resolutionNote || undefined,
      };

      const res = await api.patch(`/disputes/${dispute.id}/resolve`, body);
      setDispute(res.data);
      toast.success("Dispute resolved successfully.");

      setTimeout(() => {
        navigate("/admin/disputes");
      }, 800);
    } catch (err) {
      console.error("Failed to resolve dispute:", err);
      toast.error(
        err?.response?.data?.error || "Failed to resolve dispute from server."
      );
    } finally {
      setResolving(false);
    }
  };

  // عند تأكيد المودال
  const handleConfirmDialog = async () => {
    const { action } = confirmState;
    setConfirmState({ open: false, action: null });
    if (!action) return;
    await resolveDispute(action);
  };

  // إلغاء المودال
  const handleCancelDialog = () => {
    setConfirmState({ open: false, action: null });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-200">
          You must be logged in to access this page.
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-red-600 dark:text-red-400 font-semibold">
          You are not authorized to access the admin panel.
        </p>
      </div>
    );
  }

  if (loading || !dispute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-300">Loading dispute...</p>
      </div>
    );
  }

  const isSale = dispute.deal_type === "sale";
  const isSwapEqual = dispute.deal_type === "swap_equal";

  // نصوص المودال حسب نوع الإجراء
  const getConfirmTexts = () => {
    const action = confirmState.action;
    if (action === "refund_buyer") {
      return {
        title: "استرداد المبلغ للمشتري وإغلاق النزاع",
        description:
          "هل أنت متأكد أنك تريد استرداد المبلغ للمشتري وإغلاق هذا النزاع نهائيًا؟ سيتم تنفيذ عملية Refund عبر Stripe وتحديث حالة الصفقة.",
        confirmLabel: "تأكيد الاسترداد",
      };
    }
    if (action === "refund_both_sides") {
      return {
        title: "استرداد رسوم الحماية للطرفين",
        description:
          "سيتم استرداد رسوم الحماية للطرفين ووضع حالة التبادل كـ 'فشل التبادل'. هل تريد المتابعة؟",
        confirmLabel: "تأكيد الاسترداد للطرفين",
      };
    }
    if (action === "reject") {
      return {
        title: "رفض هذا النزاع",
        description:
          "هل أنت متأكد أنك تريد رفض هذا النزاع وإغلاقه بدون أي استرداد؟",
        confirmLabel: "تأكيد الرفض",
      };
    }
    return {
      title: "",
      description: "",
      confirmLabel: "Confirm",
    };
  };

  const { title, description, confirmLabel } = getConfirmTexts();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-10 px-4">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">
              Dispute #{dispute.id}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Type: <span className="uppercase">{dispute.deal_type}</span> •
              &nbsp;Deal ID: {dispute.deal_id}
            </p>
          </div>

          <Link
            to="/admin/disputes"
            className="px-3 py-1.5 text-xs rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100"
          >
            ← Back to list
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Dispute Details
            </h2>
            <div className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
              <p>
                <span className="font-medium">Opened by:</span>{" "}
                User #{dispute.opened_by} ({dispute.opened_by_role})
              </p>
              <p>
                <span className="font-medium">Reason:</span>{" "}
                {dispute.reason_code.replace(/_/g, " ")}
              </p>
              <p>
                <span className="font-medium">Status:</span>{" "}
                <span
                  className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    dispute.status === "open"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                      : dispute.status === "resolved_refunded"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                      : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
                  }`}
                >
                  {dispute.status}
                </span>
              </p>
              <p>
                <span className="font-medium">Created at:</span>{" "}
                {new Date(dispute.created_at).toLocaleString()}
              </p>
              {dispute.resolved_at && (
                <p>
                  <span className="font-medium">Resolved at:</span>{" "}
                  {new Date(dispute.resolved_at).toLocaleString()}
                </p>
              )}
              {dispute.resolution_note && (
                <p>
                  <span className="font-medium">Resolution note:</span>{" "}
                  {dispute.resolution_note}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Deal Parties
            </h2>
            {offer ? (
              <div className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
                <p>
                  <span className="font-medium">Offer ID:</span> {offer.id} (
                  {offer.offer_type})
                </p>
                <p>
                  <span className="font-medium">Gift ID:</span> {offer.gift_id}
                </p>
                <p>
                  <span className="font-medium">Party A / Sender:</span> User #
                  {offer.sender_id}
                </p>
                <p>
                  <span className="font-medium">Party B / Owner:</span> User #
                  {offer.owner_id}
                </p>
                <p>
                  <span className="font-medium">Sale status:</span>{" "}
                  {offer.sale_status || "none"}
                </p>
                <p>
                  <span className="font-medium">Swap status:</span>{" "}
                  {offer.swap_status || "none"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Unable to load offer details.
              </p>
            )}
          </div>
        </div>

        {/* منطقة اتخاذ القرار */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Resolution
          </h2>

          <textarea
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
            placeholder="Internal resolution note (optional)..."
            rows={3}
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
          />

          {dispute.status !== "open" ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This dispute is already resolved. No further actions are allowed.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {isSale && (
                <>
                  <button
                    disabled={resolving}
                    onClick={() => handleResolveClick("refund_buyer")}
                    className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                  >
                    {resolving ? "Processing..." : "Refund buyer & close"}
                  </button>
                  <button
                    disabled={resolving}
                    onClick={() => handleResolveClick("reject")}
                    className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                  >
                    {resolving ? "Processing..." : "Reject dispute"}
                  </button>
                </>
              )}

              {isSwapEqual && (
                <>
                  <button
                    disabled={resolving}
                    onClick={() => handleResolveClick("refund_both_sides")}
                    className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                  >
                    {resolving ? "Processing..." : "Refund both sides"}
                  </button>
                  <button
                    disabled={resolving}
                    onClick={() => handleResolveClick("reject")}
                    className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                  >
                    {resolving ? "Processing..." : "Reject dispute"}
                  </button>
                </>
              )}

              {!isSale && !isSwapEqual && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Custom resolution logic for this deal_type is not implemented
                  yet.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* مودال التأكيد */}
      <ConfirmDialog
        open={confirmState.open}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel="إلغاء"
        onConfirm={handleConfirmDialog}
        onCancel={handleCancelDialog}
      />
    </div>
  );
};

export default AdminDisputeView;
