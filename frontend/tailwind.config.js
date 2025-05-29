/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#1e1e1e',
        'darker-bg': '#121212',
        'sidebar-bg': '#2d2d2d',
        'accent': '#007ACC',
        'accent-hover': '#0098FF',
        'text-primary': '#CCCCCC',
        'text-secondary': '#969696',
        'border': '#404040',
      }
    },
  },
  plugins: [],
} 