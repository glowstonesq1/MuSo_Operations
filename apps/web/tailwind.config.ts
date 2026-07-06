import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slotblue: "#3B82F6",
        slotgreen: "#10B981",
        slotpurple: "#8B5CF6",
        slotyellow: "#F59E0B",
        school: "#475569",
        csr: "#EA580C",
        birthday: "#EC4899",
        workshop: "#0D9488",
        summercamp: "#D97706",
      },
    },
  },
  plugins: [],
};
export default config;
