/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#020202',
        surface: '#0A0A0A',
        foreground: '#E0E0E0',
        muted: '#888888',
        border: '#333333',
        primary: '#FF4500',
        'primary-foreground': '#FFFFFF',
        destructive: '#FF2D55',
      },
    },
  },
  plugins: [],
};
