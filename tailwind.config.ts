import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semaforo / event kinds (secção 6)
        inc: "#dc2626", // incidência · vermelho
        rec: "#16a34a", // recorrente · verde
        proj: "#a78bd6", // projeto · roxo
        semaforo: {
          verde: "#16a34a",
          amarelo: "#d97706",
          vermelho: "#dc2626",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
