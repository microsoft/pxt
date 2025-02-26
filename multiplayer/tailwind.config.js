/** @type {import('tailwindcss').Config} */
module.exports = {
    prefix: "tw-",
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            /* TODO multiplayer : How does high contrast work? */
            colors: {
                "primary-color": "var(--pxt-primary-background)",
                "secondary-color": "var(--pxt-secondary-background)",
                "tertiary-color": "var(--pxt-tertiary-background)",
                "inactive-color": "var(--pxt-neutral-background3)",
                "body-background-color": "var(--pxt-neutral-background1);",
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
