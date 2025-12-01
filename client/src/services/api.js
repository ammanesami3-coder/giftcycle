import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

export default api;

// ========== OFFERS ==========

export const createOffer = async (offerData) => {
  try {
    const response = await api.post("/offers", offerData);
    return response.data;
  } catch (err) {
    console.error("❌ Error creating offer:", err);
    throw err;
  }
};

export const getSentOffers = async (emailOrId) => {
  try {
    const res = await api.get(`/offers/sent/${emailOrId}`);
    return res.data;
  } catch (err) {
    console.error("Error fetching sent offers:", err);
    throw err;
  }
};

export const getReceivedOffers = async (emailOrId) => {
  try {
    const res = await api.get(`/offers/received/${emailOrId}`);
    return res.data;
  } catch (err) {
    console.error("Error fetching received offers:", err);
    throw err;
  }
};

export const updateOfferStatus = async (id, status) => {
  try {
    const res = await api.patch(`/offers/${id}`, { status });
    return res.data;
  } catch (err) {
    console.error("Error updating offer status:", err);
    throw err;
  }
};

// ========== AUTH ==========

export const registerUser = async (data) => {
  return api.post("/auth/register", data);
};

export const loginUser = (data) => api.post("/auth/login", data);

// ========== GIFTS ==========

export const deleteGift = async (giftId) => {
  try {
    const res = await api.delete(`/gifts/${giftId}`);
    return res.data;
  } catch (err) {
    console.error("Error deleting gift:", err);
    throw err;
  }
};

export const getSimilarGifts = async (id) => {
  const res = await api.get(`/gifts/similar/${id}`);
  return res.data;
};

// ========== DISPUTES (NEW) ==========

export const createDispute = (data) => api.post("/disputes", data);

export const getDealDispute = (dealType, dealId) =>
  api.get(`/disputes/by-deal/${dealType}/${dealId}`);
