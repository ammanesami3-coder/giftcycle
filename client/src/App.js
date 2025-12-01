import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import AddGift from "./pages/AddGift";
import GiftDetails from "./pages/GiftDetails";
import MyOffers from "./pages/MyOffers";
import OffersReceived from "./pages/OffersReceived";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MyGifts from "./pages/MyGifts";
import OfferConversation from "./pages/OfferConversation";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import SwapSuccess from "./pages/SwapSuccess";
import SwapCancel from "./pages/SwapCancel";
import SaleSuccess from "./pages/SaleSuccess";
import SaleCancel from "./pages/SaleCancel";

// صفحات لوحة المشرف للنزاعات
import AdminDisputes from "./pages/admin/AdminDisputes";
import AdminDisputeView from "./pages/admin/AdminDisputeView";

function App() {
  return (
    <Router>
      <Toaster
        position="top-center"
        toastOptions={{
          className: "rounded-xl font-medium shadow-lg",
          duration: 4000,
          style: {
            background: "var(--toast-bg)",
            color: "var(--toast-text)",
            border: "1px solid var(--toast-border)",
            padding: "12px 16px",
          },
          success: {
            iconTheme: {
              primary: "#22c55e",
              secondary: "#ffffff",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#ffffff",
            },
          },
          loading: {
            iconTheme: {
              primary: "#3b82f6",
              secondary: "#ffffff",
            },
          },
        }}
      />

      {/* Navbar */}
      <Navbar />

      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/gift/:id" element={<GiftDetails />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/swap-success" element={<SwapSuccess />} />
        <Route path="/swap-cancel" element={<SwapCancel />} />
        <Route path="/sale-success" element={<SaleSuccess />} />
        <Route path="/sale-cancel" element={<SaleCancel />} />

        {/* Protected routes */}
        <Route
          path="/add"
          element={
            <ProtectedRoute>
              <AddGift />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-offers"
          element={
            <ProtectedRoute>
              <MyOffers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/offers-received"
          element={
            <ProtectedRoute>
              <OffersReceived />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-gifts"
          element={
            <ProtectedRoute>
              <MyGifts />
            </ProtectedRoute>
          }
        />

        <Route
          path="/offer/:id/chat"
          element={
            <ProtectedRoute>
              <OfferConversation />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* لوحة المشرف – إدارة النزاعات */}
        <Route
          path="/admin/disputes"
          element={
            <ProtectedRoute>
              <AdminDisputes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/disputes/:id"
          element={
            <ProtectedRoute>
              <AdminDisputeView />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
