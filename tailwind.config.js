/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: '#0a0e1a',
        card: '#0f1520',
        'border-col': '#1a2535',
        accent: '#1D9E75',
        alert: '#E24B4A',
        amber: '#EF9F27',
      }
    },
  },
  plugins: [],
}
