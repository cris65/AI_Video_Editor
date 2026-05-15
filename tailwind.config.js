/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      zIndex: {
        'base': 0,
        'ui': 100,
        'floating': 500,
        'dropdown': 1000,
        'tooltip': 1500,
        'app-modal': 5000,
        'system-modal': 10000,
        'notification': 20000,
        'god': 100000,
      }
    },
  },
  plugins: [],
}
