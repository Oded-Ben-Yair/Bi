/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Microsoft Copilot color palette
        copilot: {
          primary: '#5E5CD6',
          secondary: '#7C7BDE',
          accent: '#9B9AE6',
          dark: '#1F1F1F',
          darker: '#141414',
          light: '#F3F3F3',
          border: '#323232',
          hover: '#2A2A2A',
          text: {
            primary: '#FFFFFF',
            secondary: '#B3B3B3',
            muted: '#7A7A7A',
          },
          gradient: {
            start: '#5E5CD6',
            mid: '#7C7BDE',
            end: '#9B9AE6',
          },
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6',
        },
        axia: {
          primary: '#2563EB',
          secondary: '#3B82F6',
          accent: '#60A5FA',
        }
      },
      fontFamily: {
        'segoe': ['Segoe UI', 'system-ui', 'sans-serif'],
        'mono': ['Cascadia Code', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 3s ease infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'typing': 'typing 1.5s ease-out infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        typing: {
          '0%': { opacity: 0.4 },
          '50%': { opacity: 1 },
          '100%': { opacity: 0.4 },
        },
      },
      backgroundImage: {
        'copilot-gradient': 'linear-gradient(135deg, #5E5CD6 0%, #7C7BDE 50%, #9B9AE6 100%)',
        'axia-gradient': 'linear-gradient(135deg, #2563EB 0%, #3B82F6 50%, #60A5FA 100%)',
      },
      boxShadow: {
        'copilot': '0 4px 24px rgba(94, 92, 214, 0.15)',
        'copilot-hover': '0 8px 32px rgba(94, 92, 214, 0.25)',
      },
    },
  },
  plugins: [],
};