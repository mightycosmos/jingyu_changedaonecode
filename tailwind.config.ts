import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        sidebar: "var(--sidebar)",
        surface: "var(--surface)",
        border: "var(--border)",
        primary: {
          DEFAULT: "#0A84FF",
          hover: "#007AFF",
        },
        secondary: {
          DEFAULT: "#2C2C2E",
          hover: "#3A3A3C",
        },
        gray: {
          400: "#8E8E93",
          500: "#636366",
        }
      },
    },
  },
  plugins: [],
};
export default config;



