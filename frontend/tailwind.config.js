/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0efff",
          200: "#bbdcff",
          300: "#8bc4ff",
          400: "#54a4ff",
          500: "#2b86f7",
          600: "#1a68d4",
          700: "#1652a8",
          800: "#154687",
          900: "#143d70",
        },
      },
    },
  },
  plugins: [],
};
