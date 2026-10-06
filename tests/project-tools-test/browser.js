"use strict";

const puppeteer = require("puppeteer");

function browserLaunchOptions(env = process.env) {
    return {
        headless: true,
        // Fail stalled browser commands before Mocha's 30-second hook timeout.
        protocolTimeout: 10000,
        // GitHub Actions may block Chromium's sandbox via AppArmor or stall GPU initialization.
        // Leave the local browser defaults unchanged.
        args: env.GITHUB_ACTIONS === "true" ? ["--no-sandbox", "--disable-gpu"] : []
    };
}

const launchTestBrowser = () => puppeteer.launch(browserLaunchOptions());

module.exports = { browserLaunchOptions, launchTestBrowser };