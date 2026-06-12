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
        sidebar: {
          bg: "#0f172a",
          hover: "#1e293b",
          active: "#1e40af",
          text: "#94a3b8",
          "text-active": "#f1f5f9",
        },
      },
    },
  },
  plugins: [],
};

export default config;
