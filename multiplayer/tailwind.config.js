/** @type {import('tailwindcss').Config} */
module.exports = {
  prefix: 'tw-',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    /* TODO thsparks : How does high contrast work? */
    colors: {
      'primary-color': 'var(--primary-color)',
      'secondary-color': 'var(--secondary-color)',
      'tertiary-color': 'var(--tertiary-color)',
      'inactive-color': 'var(--inactive-color)',
      'body-background-color': 'var(--body-background-color);',
      'white': 'var(--white)'
    },
    fontFamily: {
      segoueUI: ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana']
    },
    extend: {},
  },
  plugins: [],
}
