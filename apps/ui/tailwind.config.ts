import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Super Mario palette
        mario: {
          red:     "#E52521",
          redDark: "#B31B17",
          blue:    "#049CD8",
          blueDk:  "#035B7E",
          yellow:  "#FBD000",
          green:   "#43B047",
          greenDk: "#1E7A20",
          brown:   "#6D3B0A",
          skin:    "#FDCBA4",
          sky:     "#6ECEFF",
          coin:    "#F7C924",
          pipe:    "#00A651",
        },
        // anime neon accents
        neon: {
          pink:   "#FF3DA5",
          purple: "#9B30FF",
          cyan:   "#00F5FF",
          lime:   "#B0FF3D",
        },
        // dark chrome
        ink: {
          50:  "#f4f5fb",
          100: "#e8eaf1",
          200: "#c7cbdc",
          300: "#9da3bf",
          700: "#232738",
          800: "#10131f",
          900: "#080a13",
          950: "#04050a",
        },
      },
      fontFamily: {
        pixel:   ['"Press Start 2P"', "ui-monospace", "monospace"],
        display: ['"VT323"', "monospace"],
        sans:    ["Inter", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        pixel:    "4px 4px 0 0 rgba(0,0,0,0.85)",
        pixelSm:  "2px 2px 0 0 rgba(0,0,0,0.85)",
        pixelLg:  "6px 6px 0 0 rgba(0,0,0,0.85)",
        neon:     "0 0 20px rgba(0,245,255,0.6), 0 0 40px rgba(155,48,255,0.35)",
        neonPink: "0 0 18px rgba(255,61,165,0.7)",
      },
      animation: {
        bob:     "bob 1.2s ease-in-out infinite",
        sparkle: "sparkle 1.6s linear infinite",
        scan:    "scan 6s linear infinite",
        coin:    "coin 0.9s linear infinite",
        slide:   "slide 25s linear infinite",
      },
      keyframes: {
        bob:     { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        sparkle: { "0%,100%": { opacity: "0.3", transform: "scale(0.9)" }, "50%": { opacity: "1", transform: "scale(1.15)" } },
        scan:    { "0%": { backgroundPositionY: "0" }, "100%": { backgroundPositionY: "100%" } },
        coin:    { "0%,100%": { transform: "rotateY(0)" }, "50%": { transform: "rotateY(180deg)" } },
        slide:   { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
      },
    },
  },
  plugins: [],
} satisfies Config;
