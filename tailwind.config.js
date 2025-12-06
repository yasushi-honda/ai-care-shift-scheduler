/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        'care-primary': '#4338ca',
        'care-secondary': '#4f46e5',
        'care-light': '#e0e7ff',
        'care-dark': '#3730a3',
        // Phase 42: ボタンデザイン統一用カラー
        'btn-primary': {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
          active: '#3730A3',
        },
        'btn-success': {
          DEFAULT: '#059669',
          hover: '#047857',
          active: '#065F46',
        },
        'btn-secondary': {
          DEFAULT: '#F3F4F6',
          hover: '#E5E7EB',
          text: '#374151',
        },
      },
      // Phase 42: ボタンサイズ統一
      minWidth: {
        'btn-sm': '4rem',
        'btn-md': '5rem',
      },
      backgroundImage: {
        'select-arrow': `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
      }
    }
  },
  plugins: [],
}

