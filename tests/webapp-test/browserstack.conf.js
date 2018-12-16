// Browser Stack configuration
var https = require('https');

var user = process.env.BROWSERSTACK_USERNAME || 'BROWSERSTACK_USERNAME';
var key = process.env.BROWSERSTACK_ACCESS_KEY || 'BROWSERSTACK_ACC_KEY';

var build = 'pxt-microbit';
var baseUrl = 'https://makecode.microbit.org/';

exports.config = {
  user: user,
  key: key,

  updateJob: false,
  specs: ['../../built/tests/webapp-test/tests/*.js'],
  suites: {
    search: [
      '../../built/tests/webapp-test/tests/search.js'
    ],
    accessibility: [
      '../../built/tests/webapp-test/tests/accessibility.js'
    ],
    blockly: [
      '../../built/tests/webapp-test/tests/blockly.js'
    ],
    tutorial: [
      '../../built/tests/webapp-test/tests/tutorial.js'
    ],
    import: [
      '../../built/tests/webapp-test/tests/import.js'
    ]
  },
  exclude: [],
  maxInstances: 10,

  commonCapabilities: {
    resolution: "1600x1200",
    build: build,
    //'browserstack.selenium_version': '3.14.0',
    'browserstack.debug': 'true'
  },

  capabilities: [
    {
      browser: 'chrome',
      browser_version: '70.0',
      name: 'chrome'
    },
    // {
    //   browser: 'edge',
    //   browser_version: '17.0',
    //   name: 'edge'
    // },
    // {
    //   browser: 'firefox',
    //   browser_version: '63.0',
    //   name: 'firefox'
    // },
    // {
    //   browser: 'internet explorer',
    //   browser_version: '11.0',
    //   os: 'Windows',
    //   os_version: '10',
    //   name: 'ie'
    // },
    // {
    //   browser: 'safari',
    //   browser_version: '12.0',
    //   name: 'safari'
    // }
  ],
  //capabilities: [],

  logLevel: 'verbose',
  coloredLogs: true,
  screenshotPath: './errorShots/',
  baseUrl: baseUrl,
  waitforTimeout: 40000,
  connectionRetryTimeout: 90000,
  connectionRetryCount: 3,
  host: 'hub.browserstack.com',

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000 * 3 // 3 minutes per test
  },

  beforeSession: function (config, capabilities, specs) {
    var testname = specs && specs[0].split('/').pop() || '';
    var name = testname + "(" + capabilities.name + ")";
    capabilities.name = name;
  },

  beforeTest: function (test) {
    // Always maximize the window before a test
    browser.windowHandleMaximize();
  },

  afterTest: function (test) {
    if (!test.passed) {
      console.log("Test failed, reporting error with browserstack");
      console.log(test);
      var options = {
        hostname: 'api.browserstack.com',
        path: '/automate/sessions/' + browser.sessionId + '.json',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(user + ':' + key).toString('base64')
        }
      };
      var json = JSON.stringify({ 'status': 'failed', 'reason': test.err.message });
      var req = https.request(options);
      req.write(json);
      req.on('error', (e) => {
        console.error(e);
      });
      req.end();
    }
    // else {
    //   var options = {
    //     hostname: 'api.browserstack.com',
    //     path: '/automate/sessions/' + browser.sessionId + '.json',
    //     method: 'PUT',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'Authorization': 'Basic ' + Buffer.from(user + ':' + key).toString('base64')
    //     }
    //   };
    //   var json = JSON.stringify({ 'status': 'passed'});
    //   var req = https.request(options);
    //   req.write(json);
    //   req.on('error', (e) => {
    //     console.error(e);
    //   });
    //   req.end();
    // }
  }
}

// Code to add browsers based on args

// supportedCapabilities

// Code to support common capabilities
exports.config.capabilities.forEach(function (caps) {
  for (var i in exports.config.commonCapabilities) caps[i] = caps[i] || exports.config.commonCapabilities[i];
});