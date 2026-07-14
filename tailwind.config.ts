import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#ffffff",
        ink: "#0a0a0a",
        muted: "#6b7280",
      },
    },
  },
  plugins: [],
};

export default config;
