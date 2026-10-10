/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './apps/web/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#E11D48',
          dark: '#BE123C',
          light: '#FFF1F2',
        },
        surface: {
          cream: '#F5EFEA',
          warm: '#FAF7F2',
          sidebar: '#0F172A',
        },
      },
    },
  },
  plugins: [],
};
