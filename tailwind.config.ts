import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // WorkRoute palette — dark rig charcoal, off-white paper, safety-amber accent.
        // Deliberately not the generic cream/terracotta or acid-green/black defaults.
        rig: {
          950: "#14171C", // near-black chrome, used sparingly (nav, footer)
          900: "#1C1F26", // primary dark surface
          800: "#262B33",
          700: "#3A4149",
        },
        paper: {
          50: "#FAF9F6", // page background — warm off-white, easy to read on a job site in daylight
          100: "#F1EFE9",
        },
        amber: {
          500: "#F2A900", // primary action — safety-amber, not hazard-orange cliché
          600: "#D69400",
        },
        steel: {
          500: "#3B5166", // secondary actions, links, icons
          600: "#2D3E4F",
        },
        rust: {
          500: "#B23A2F", // errors
        },
        moss: {
          500: "#4C7A51", // success / confirmed states
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        lg: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
