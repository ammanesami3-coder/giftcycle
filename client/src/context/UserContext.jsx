import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // تسجيل الخروج
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  // تحميل المستخدم عند فتح الموقع (إذا كان التوكن موجودًا)
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const token = localStorage.getItem("token");
        const savedUser = localStorage.getItem("user");

        if (token && savedUser) {
          const parsedUser = JSON.parse(savedUser);

          // التحقق من أن المستخدم ما زال موجودًا وصالحًا
          const res = await api.get(`/users/${parsedUser.id}`);
          if (res.data) {
            setUser(res.data);
            localStorage.setItem("user", JSON.stringify(res.data)); // تحديث البيانات
          } else {
            logout();
          }
        } else {
          // لا يوجد توكن => نكتفي بجعل user = null
          setUser(null);
        }
      } catch (err) {
        console.error("❌ Error verifying user:", err);
        logout();
      } finally {
        setLoadingUser(false);
      }
    };

    initializeUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, logout, loadingUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
