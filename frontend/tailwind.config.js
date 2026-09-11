/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    borderRadius: {
      none: "0px",
      sm: "8px",
      DEFAULT: "10px",
      md: "10px",
      lg: "10px",
      xl: "10px",
      "2xl": "10px",
      "3xl": "10px",
      full: "9999px",
    },
    extend: {
      colors: {
        canvas: "#f7f7f5",
        ink: "#343235",
        muted: "#747579",
        line: "#e2e4e0",
        brand: {
          DEFAULT: "rgb(var(--color-brand) / <alpha-value>)",
          ink: "rgb(var(--color-brand-ink) / <alpha-value>)",
          soft: "rgb(var(--color-brand-soft) / <alpha-value>)",
          border: "rgb(var(--color-brand-border) / <alpha-value>)",
        },
        teal: "#2d8c86",
        blue: "#356b98",
      },
    },
  },
  plugins: [],
};
