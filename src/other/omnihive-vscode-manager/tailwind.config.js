module.exports = {
    purge: ["./src/**/*.{ts,tsx}"],
    darkMode: "media", // or 'media' or 'class'
    variants: {
        extend: {
            opacity: ["disabled"],
        },
    },
    theme: {
        extend: {
            colors: {
                omnihive: {
                    orange: "#d38d13",
                    orangeHover: "#eca62d",
                },
            },
        },
    },
    plugins: [],
};
