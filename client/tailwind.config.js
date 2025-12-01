/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class", // ← مهم جداً لتمكين الوضع المظلم
  content: [
    "./public/index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [
    // يمكنك حذف هذا لأنه مدمج تلقائياً، أو تركه بدون مشكلة
    require('@tailwindcss/line-clamp'),
  ],
};
