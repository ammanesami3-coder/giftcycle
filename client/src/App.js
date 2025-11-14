import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";

import Home from "./pages/Home";
import AddGift from "./pages/AddGift";
import GiftDetails from "./pages/GiftDetails";
import MyOffers from "./pages/MyOffers";
import OffersReceived from "./pages/OffersReceived";
import Login from "./pages/Login";
import Register from "./pages/Register";

function App() {
  return (
    <Router>
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/add" element={<AddGift />} />
        <Route path="/gift/:id" element={<GiftDetails />} />
        <Route path="/my-offers" element={<MyOffers />} />
        <Route path="/offers-received" element={<OffersReceived />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </Router>
  );
}

export default App;
