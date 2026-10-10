import path from "node:path";

// root から vite build すると PostCSS の CWD が root になり、tailwindcss は tailwind.config.ts を見失う
export default {
  plugins: {
    tailwindcss: {
      config: path.join(import.meta.dirname, "tailwind.config.ts"),
    },
    autoprefixer: {},
  },
};
