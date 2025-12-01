import React, { useEffect, useState } from "react";
import api from "../services/api";
import { useUser } from "../context/UserContext";
import { Bell, MessageCircle, Gift, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const getNotificationMeta = (type) => {
  switch (type) {
    case "offer_received":
      return {
        label: "New offer",
        icon: <Gift className="w-4 h-4" />,
        accentClass: "bg-blue-500",
        pillClass:
          "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200",
      };
    case "message_received":
      return {
        label: "New message",
        icon: <MessageCircle className="w-4 h-4" />,
        accentClass: "bg-green-500",
        pillClass:
          "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-200",
      };
    case "offer_accepted":
      return {
        label: "Offer accepted",
        icon: <CheckCircle2 className="w-4 h-4" />,
        accentClass: "bg-amber-500",
        pillClass:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200",
      };
    default:
      return {
        label: "Notification",
        icon: <Bell className="w-4 h-4" />,
        accentClass: "bg-gray-400",
        pillClass:
          "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
      };
  }
};

const Notifications = () => {
  const { user } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      try {
        const res = await api.get(`/notifications/${user.id}`);
        setNotifications(res.data);
      } catch (err) {
        toast.error("Failed to load notifications");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // التعامل مع الضغط على الإشعار
  const handleClick = async (note) => {
    try {
      if (!note.is_read) {
        await api.patch(`/notifications/${note.id}/read`);

        setNotifications((prev) =>
          prev.map((n) => (n.id === note.id ? { ...n, is_read: true } : n))
        );

        // إعلام النافبار بأن إشعارًا تمت قراءته
        window.dispatchEvent(
          new CustomEvent("notification_read", { detail: { count: 1 } })
        );
      }

      if (note.link) {
        navigate(note.link);
      } else {
        toast(note.message);
      }
    } catch {
      toast.error("Failed to open notification");
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-300">Loading...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
          <Bell className="text-yellow-500" /> Notifications
        </h2>

        {notifications.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center">
            No notifications yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {notifications.map((note) => {
              const meta = getNotificationMeta(note.type);

              return (
                <li
                  key={note.id}
                  onClick={() => handleClick(note)}
                  className={`cursor-pointer flex gap-3 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition 
                    ${
                      note.is_read
                        ? "opacity-70"
                        : "hover:bg-gray-50 dark:hover:bg-gray-750"
                    }`}
                >
                  {/* شريط جانبي ملوّن حسب النوع */}
                  <div
                    className={`w-1 ${meta.accentClass} flex-shrink-0`}
                  ></div>

                  <div className="flex-1 px-3 py-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${meta.pillClass}`}
                        >
                          {meta.icon}
                          {meta.label}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        {new Date(note.created_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-sm text-gray-800 dark:text-gray-100">
                      {note.message}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Notifications;
