/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          yellow: "#FACC15",
          amber: "#F59E0B",
          gold: "#EAB308",
          beige: "#F5F0E6",
          sand: "#EDE8DF",
          cream: "#FAF7F2",
          dark: "#0B0C10",
          vinyl: "#13141B",
          card: "#191B24",
          border: "#2A2D3C",
          muted: "#9CA3AF"
        }
      },
      fontFamily: {
        grotesk: ["Cabinet Grotesk", "Space Grotesk", "Inter", "sans-serif"],
        display: ["Syne", "Cabinet Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      backgroundImage: {
        'grain-pattern': "radial-gradient(circle at 50% 0%, rgba(250, 204, 21, 0.15) 0%, transparent 60%), radial-gradient(circle at 100% 100%, rgba(245, 240, 230, 0.08) 0%, transparent 50%)",
        'yellow-gradient': "linear-gradient(135deg, #FDE047 0%, #FACC15 50%, #EAB308 100%)",
        'card-gradient': "linear-gradient(180deg, rgba(25, 27, 36, 0.95) 0%, rgba(19, 20, 27, 0.95) 100%)",
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
      }
    },
  },
  plugins: [],
}
