const webpack = require("webpack");
const { aliasWebpack } = require("react-app-alias-ex");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = function (config) {
    const aliasFn = aliasWebpack({});
    config = {
        ...aliasFn(config),
        plugins: [...config.plugins, new NodePolyfillPlugin()],
    };
    return config;
};
