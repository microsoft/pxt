const webpack = require("webpack");
const { aliasWebpack } = require("react-app-alias-ex");

module.exports = function (config) {
    const aliasFn = aliasWebpack({});
    config = {
        ...aliasFn(config),
        // Additional webpack config here
        plugins: [
            ...config.plugins,
            new webpack.ProvidePlugin({
                Buffer: ["buffer", "Buffer"],
            }),
        ],
    };
    return config;
};
