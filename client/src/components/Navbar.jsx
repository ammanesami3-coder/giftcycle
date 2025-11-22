import { Bell } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import api from "../services/api";

// اتصال Socket.io مشترك في النافبار
const socket = io("http://localhost:5000", {
  transports: ["websocket"],
  reconnectionAttempts: 5,
});

const Navbar = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [unreadCount, setUnreadCount] = useState(0);

  // تطبيق الثيم على <html>
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // جلب عدد الإشعارات غير المقروءة عند تحميل النافبار
  useEffect(() => {
    const fetchUnread = async () => {
      if (!user?.id) {
        setUnreadCount(0);
        return;
      }
      try {
        const res = await api.get(`/notifications/${user.id}`);
        const unread = res.data.filter((n) => !n.is_read).length;
        setUnreadCount(unread);
      } catch (err) {
        console.error("Failed to load notifications count", err);
      }
    };

    fetchUnread();
  }, [user]);

  // تسجيل المستخدم في Socket.io + الاستماع للإشعارات الجديدة (زيادة العدّاد)
  useEffect(() => {
    if (!user?.id) return;

    // تسجيل المستخدم لاستقبال إشعاراته
    socket.emit("registerUser", user.id);

    const handleNotification = (notification) => {
      setUnreadCount((prev) => prev + 1);

      // ترك الصوت لنسخة لاحقة (محذوف الآن)
      // const audio = new Audio("/sounds/notification.mp3");
      // audio.play().catch(() => {});
    };

    socket.on("notificationReceived", handleNotification);

    return () => {
      socket.off("notificationReceived", handleNotification);
    };
  }, [user]);

  // الاستماع لحدث "notification_read" القادم من صفحة الإشعارات (نقصان العدّاد)
  useEffect(() => {
    const handleNotificationRead = (event) => {
      const delta = event.detail?.count ?? 1;
      setUnreadCount((prev) => Math.max(prev - delta, 0));
    };

    window.addEventListener("notification_read", handleNotificationRead);
    return () => {
      window.removeEventListener("notification_read", handleNotificationRead);
    };
  }, []);

  return (
    <nav className="bg-white dark:bg-gray-900 shadow-md px-4 py-3 flex flex-wrap justify-between items-center transition">
      {/* Logo */}
      <Link
        to="/"
        className="text-2xl font-bold text-blue-600 dark:text-blue-400 tracking-tight"
      >
        GiftCycle
      </Link>

      {/* Links */}
      <div className="flex items-center gap-5 flex-wrap">
        {/* Public Links */}
        <Link
          to="/"
          className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          Home
        </Link>

        <Link
          to="/add"
          className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          Add Gift
        </Link>

        {/* Logged-in user links */}
        {user && (
          <>
            <Link
              to="/my-offers"
              className="text-blue-600 dark:text-blue-400 hover:underline transition"
            >
              My Offers
            </Link>

            <Link
              to="/offers-received"
              className="text-green-700 dark:text-green-400 hover:underline transition"
            >
              Offers Received
            </Link>

            <Link
              to="/my-gifts"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 
                         dark:bg-blue-500 dark:hover:bg-blue-600 
                         text-white px-4 py-2 rounded-lg shadow transition"
            >
              🎁 <span>My Gifts</span>
            </Link>

            <Link
              to="/notifications"
              className="bg-yellow-500 hover:bg-yellow-600 
                         dark:bg-yellow-400 dark:hover:bg-yellow-500 
                         text-white px-4 py-2 rounded-lg shadow transition relative flex items-center"
            >
              <Bell />
              <span className="ml-2">Notifications</span>
              {unreadCount > 0 && (
                <span
                  className="absolute -top-2 -right-2 bg-red-600 text-white 
                             text-xs rounded-full px-1.5 py-0.5 flex items-center justify-center"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            <Link
              to="/profile"
              className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 
                         dark:bg-gray-700 dark:hover:bg-gray-600 
                         text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg shadow transition"
            >
              👤 <span>My Profile</span>
            </Link>
          </>
        )}

        {/* Guest links */}
        {!user && (
          <>
            <Link
              to="/login"
              className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition"
            >
              Register
            </Link>
          </>
        )}

        {/* User info + logout */}
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-gray-700 dark:text-gray-300">
              Hi, {user.name?.split(" ")[0] || "User"}
            </span>
            <button
              onClick={handleLogout}
              className="text-red-600 dark:text-red-400 hover:underline font-medium transition"
            >
              Logout
            </button>
          </div>
        )}

        {/* Theme toggle button */}
        <button
          onClick={toggleTheme}
          className="px-3 py-1 rounded-lg border dark:border-gray-700 
                     text-sm text-gray-700 dark:text-gray-300 
                     hover:bg-gray-200 dark:hover:bg-gray-800 transition"
        >
          {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
