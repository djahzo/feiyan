/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-gold': '#E8B84B',
        'brand-dark': '#0A0E14',
        'brand-link': '#00A1D6',
      },
    },
  },
  plugins: [],
};
