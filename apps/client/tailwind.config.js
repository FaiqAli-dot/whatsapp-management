/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b1f1c',
          900: '#12332e',
          800: '#1a4540',
          700: '#245a53',
        },
        moss: {
          500: '#2f6f64',
          400: '#3d8a7c',
          300: '#5aa899',
        },
        sand: {
          50: '#f7f3ec',
          100: '#efe7da',
          200: '#e2d5c0',
        },
        coral: {
          500: '#c45c3e',
          600: '#a84b31',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Outfit"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 18px 50px rgba(11, 31, 28, 0.12)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        rise: 'rise 0.6s ease-out both',
        pulseSoft: 'pulseSoft 2.4s ease-in-out infinite',
        shimmer: 'shimmer 8s ease infinite',
      },
    },
  },
  plugins: [],
};
