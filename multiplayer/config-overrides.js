const { aliasWebpack } = require("react-app-alias-ex");

module.exports = function (config) {
    const aliasFn = aliasWebpack({});
    config = {
        ...aliasFn(config),
        // Additional webpack config here
    }
    return config;
}