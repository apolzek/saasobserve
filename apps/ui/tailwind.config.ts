import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#0a0b12", 900: "#10121c", 800: "#171a28", 700: "#232738" },
        accent: { 400: "#7c9cff", 500: "#5b7cff", 600: "#3f5cf5" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
