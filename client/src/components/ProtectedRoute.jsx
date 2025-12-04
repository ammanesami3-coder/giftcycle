// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";

const ProtectedRoute = ({ children }) => {
  const { user, loadingUser } = useUser();

  // أثناء تحميل بيانات المستخدم لا نعمل redirect
  if (loadingUser) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-300">Loading...</p>
      </div>
    );
  }

  // بعد انتهاء التحميل، إذا لا يوجد مستخدم نرجع إلى صفحة تسجيل الدخول
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // مستخدم موجود ⇒ عرض الصفحة المحمية
  return children;
};

export default ProtectedRoute;
