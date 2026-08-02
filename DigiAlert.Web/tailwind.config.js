/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-dark': '#0F172A', // Ton Bleu Nuit
        'brand-red': '#E11D48',  // Ton Rouge Action
        'brand-bg': '#F8FAFC',   // Ton fond Gris Clair
      }
    },
  },
  plugins: [],
}