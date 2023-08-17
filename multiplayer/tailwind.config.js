/** @type {import('tailwindcss').Config} */
module.exports = {
    prefix: "tw-",
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            /* TODO multiplayer : How does high contrast work? */
            colors: {
                "primary-color": "var(--primary-color)",
                "secondary-color": "var(--secondary-color)",
                "tertiary-color": "var(--tertiary-color)",
                "inactive-color": "var(--inactive-color)",
                "body-background-color": "var(--body-background-color);",
                white: "var(--white)",
                slot: {
                    0: "rgb(var(--slot-0-color))", // empty slot
                    1: "rgb(var(--slot-1-color))", // player 1
                    2: "rgb(var(--slot-2-color))", // player 2
                    3: "rgb(var(--slot-3-color))", // player 3
                    4: "rgb(var(--slot-4-color))", // player 4
                },
            },
        },
    },
    plugins: [],
};
