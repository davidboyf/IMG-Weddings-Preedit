import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', '"Fira Code"', 'monospace'],
      },
      colors: {
        // Apple OS 26 Liquid Glass palette
        glass: {
          50: 'rgba(255,255,255,0.05)',
          100: 'rgba(255,255,255,0.08)',
          200: 'rgba(255,255,255,0.12)',
          300: 'rgba(255,255,255,0.18)',
          400: 'rgba(255,255,255,0.25)',
          dark: 'rgba(0,0,0,0.3)',
          darker: 'rgba(0,0,0,0.5)',
        },
        // Wedding accent - rose champagne
        rose: {
          300: '#f4a4bb',
          400: '#e8789c',
          500: '#d4547e',
          600: '#b83d65',
        },
        gold: {
          300: '#f0d5a0',
          400: '#e4bc72',
          500: '#c9a050',
          600: '#a67c30',
        },
        // Surface tokens
        surface: {
          bg: '#06060c',
          panel: '#0d0d18',
          elevated: '#141424',
          overlay: '#1a1a2e',
          border: 'rgba(255,255,255,0.08)',
          'border-hover': 'rgba(255,255,255,0.14)',
        },
        // Text tokens
        text: {
          primary: 'rgba(255,255,255,0.95)',
          secondary: 'rgba(255,255,255,0.6)',
          tertiary: 'rgba(255,255,255,0.35)',
          accent: '#e4bc72',
        },
      },
      backdropBlur: {
        glass: '40px',
        'glass-sm': '20px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 2s infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      borderRadius: {
        glass: '16px',
        'glass-lg': '24px',
      },
      boxShadow: {
        glass: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glass-lg': '0 8px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glass-inset': 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.2)',
        glow: '0 0 20px rgba(228,188,114,0.15)',
        'glow-rose': '0 0 20px rgba(212,84,126,0.2)',
      },
    },
  },
  plugins: [],
}

export default config
