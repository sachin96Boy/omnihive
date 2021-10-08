const path = require("path");

module.exports = {
    stories: ["../stories/**/*.stories.mdx", "../stories/**/*.stories.@(js|jsx|ts|tsx)"],
    addons: [
        "@storybook/addon-links",
        "@storybook/addon-essentials",
        {
            name: "@storybook/addon-postcss",
            options: {
                postcssLoaderOptions: {
                    implementation: require("postcss"),
                },
            },
        },
        "storybook-dark-mode",
    ],
    core: {
        builder: "webpack5",
    },
    webpackFinal: async (config) => {
        config.module.rules.push({
            test: /\,css&/,
            use: [
                {
                    loader: "postcss-loader",
                    options: {
                        ident: "postcss",
                        plugins: [require("tailwindcss"), require("autoprefixer")],
                    },
                },
            ],
            include: path.resolve(__dirname, "../"),
        });
        return config;
    },
};
