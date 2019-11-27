const puppeteer = require('puppeteer');
process.env.CHROME_BIN = puppeteer.executablePath()
console.log(`chromium: `, process.env.CHROME_BIN)

// Karma configuration
module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'chai'],


    // list of files / patterns to load in the browser
    files: [
      'built/web/bluebird.min.js',
      'built/web/jquery.js',
      'built/web/typescript.js',
      'webapp/public/blockly/**/*.js',
      'built/pxtlib.js',
      'built/pxtblocks.js',
      'built/pxtcompiler.js',
      'built/tests/tests.spec.js',

      // test assets
      { pattern: 'tests/blocklycompiler-test/cases/*.blocks', watched: false, included: false, served: true, nocache: false },
      { pattern: 'tests/blocklycompiler-test/baselines/*.ts', watched: false, included: false, served: true, nocache: false },
      { pattern: 'tests/blocklycompiler-test/test-library/*', watched: false, included: false, served: true, nocache: false },

      // test package files
      { pattern: 'libs/pxt-common/*.ts', watched: false, included: false, served: true, nocache: false },

      // Needed by webworker
      { pattern: 'built/web/*.js', watched: false, included: false, served: true, nocache: false },
    ],

    proxies: {
      "/tests/": "/base/tests/blocklycompiler-test/cases/",
      "/baselines/" : "/base/tests/blocklycompiler-test/baselines/",
      "/test-library/": "/base/tests/blocklycompiler-test/test-library/",
      "/common/": "/base/libs/pxt-common/",
      // Needed by webworker
      "/blb/": "/base/built/web/"
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
    browsers: [process.env.TRAVIS ? 'chromium_travis' : 'ChromeHeadless'],

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
