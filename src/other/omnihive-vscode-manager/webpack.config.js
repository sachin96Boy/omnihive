const path = require("path");
const CompressionPlugin = require("compression-webpack-plugin");

module.exports = {
    mode: "production",
    entry: {
        reactAdmin: "./src/app/index.tsx",
    },
    output: {
        path: path.resolve(__dirname, "out"),
        filename: "[name].js",
    },
    devtool: false,
    resolve: {
        extensions: [".js", ".ts", ".tsx", ".css", ".json"],
    },
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                loader: "ts-loader",
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader", "postcss-loader"],
            },
        ],
    },
    optimization: {
        splitChunks: {
            chunks: "async",
            minSize: 20000,
            minRemainingSize: 0,
            minChunks: 1,
            maxAsyncRequests: 30,
            maxInitialRequests: 30,
            enforceSizeThreshold: 50000,
            cacheGroups: {
                defaultVendors: {
                    test: /[\\/]node_modules[\\/]/,
                    priority: -10,
                    reuseExistingChunk: true,
                },
                default: {
                    minChunks: 2,
                    priority: -20,
                    reuseExistingChunk: true,
                },
            },
        },
    },
    performance: {
        hints: false,
    },
    plugins: [new CompressionPlugin()],
};
