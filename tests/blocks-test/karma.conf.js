// Karma configuration

var process = require("process");

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)

    // This is passed by the PXT CLI
    basePath: process.env["KARMA_TARGET_DIRECTORY"],

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'chai'],


    // list of files / patterns to load in the browser
    files: [
      'node_modules/pxt-core/built/web/bluebird.min.js',
      'node_modules/pxt-core/built/web/jquery.js',
      'node_modules/pxt-core/built/web/typescript.js',
      'node_modules/pxt-core/webapp/public/blockly/**/*.js',
      'node_modules/pxt-core/built/pxtlib.js',
      'node_modules/pxt-core/built/pxtblocks.js',
      'node_modules/pxt-core/built/pxtcompiler.js',
      'node_modules/pxt-core/built/pxteditor.js',
      'built/target.js',
      'built/fieldeditors.js',

      // This gets built by 'pxt testblocks'
      'built/block-tests.js',

      // Test runner
      'node_modules/pxt-core/built/tests/blocksrunner.js',

      // Needed by webworker
      { pattern: 'node_modules/pxt-core/built/web/*.js', watched: false, included: false, served: true, nocache: false },
    ],

    proxies: {
      // Needed by webworker
      "/blb/": "/base/node_modules/built/web/",

      "/common-libs/": "/base/node_modules/pxt-common-packages/libs/",
      "/libs/": "/base/libs/",
    },


    // list of files to exclude
    exclude: [
    ],

    // preprocess matching files before serving them to the browser
    preprocessors: {
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    reporters: ['progress'],

    // web server port
    port: 9876,
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    // We don't use the watcher but for some reason this must be set to true for tests to run
    autoWatch: true,
    browsers: [process.env.TRAVIS ? 'chromium_travis' : 'Chrome'],

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity,

    // Launcher for using chromium in Travis
    customLaunchers: {
      chromium_travis: {
        base: "Chrome",
        flags: ['--no-sandbox']
      }
    }
  })
}
