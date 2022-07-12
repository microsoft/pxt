'use strict';

const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const paths = require('./paths');

const configFactory = require('../config/webpack.config.base');

module.exports = function (webpackEnv) {
  const isEnvProduction = webpackEnv === 'production';

  const config = configFactory(webpackEnv);
  config.plugins = config.plugins.filter(p => !(p instanceof HtmlWebpackPlugin));
  config.plugins.unshift(new HtmlWebpackPlugin(
    Object.assign(
      {},
      {
        inject: true,
        template: paths.appHtml,
      },
      isEnvProduction
        ? {
            minify: {
              removeComments: false,
              collapseWhitespace: false,
              removeRedundantAttributes: true,
              useShortDoctype: true,
              removeEmptyAttributes: true,
              removeStyleLinkTypeAttributes: true,
              keepClosingSlash: true,
              minifyJS: true,
              minifyCSS: true,
              minifyURLs: true,
            },
          }
        : undefined
    )
  ))

  config.resolve.alias['react'] = path.resolve('../node_modules/react');

  config.module.rules = config.module.rules.filter(el => !(el.use && el.use.some(item => !!(item.options && item.options.eslintPath))));
  return config;
};
