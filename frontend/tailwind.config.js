/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        stellar: { dark: "#0a0e1a", card: "#111827", accent: "#7c3aed", danger: "#dc2626", safe: "#16a34a" }
      }
    }
  },
  plugins: []
};
