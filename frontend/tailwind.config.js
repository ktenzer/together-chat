/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        asphalt: '#1a1a2e',
        'race-dark': '#0f0f1a',
        'race-surface': '#16213e',
        'kerbing-red': '#e74c3c',
        'neon-green': '#00ff88',
        'neon-blue': '#00d4ff',
        'neon-purple': '#b44dff',
        'neon-red': '#ff3e3e',
        'gold': '#ffd700',
        'silver': '#c0c0c0',
        'bronze': '#cd7f32',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gauge-sweep': 'gaugeSweep 1.5s ease-out forwards',
        'car-pulse': 'carPulse 1.5s ease-in-out infinite',
        'confetti-fall': 'confettiFall 3s ease-in-out forwards',
        'podium-rise': 'podiumRise 0.8s ease-out forwards',
        'checkered-scroll': 'checkeredScroll 2s linear infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        gaugeSweep: {
          '0%': { transform: 'rotate(-120deg)' },
          '100%': { transform: 'rotate(var(--gauge-angle))' },
        },
        carPulse: {
          '0%, 100%': { filter: 'brightness(1)' },
          '50%': { filter: 'brightness(1.3)' },
        },
        confettiFall: {
          '0%': { transform: 'translateY(-100%) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(100vh) rotate(720deg)', opacity: '0' },
        },
        podiumRise: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        checkeredScroll: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '40px 0' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
