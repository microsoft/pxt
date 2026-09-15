"use strict";

const puppeteer = require("puppeteer");

function browserLaunchOptions(env = process.env) {
    return {
        headless: true,
        // Surface a stalled CDP command before Mocha's 30-second hook deadline.
        protocolTimeout: 10000,
        // Match the existing Karma launcher on isolated GitHub Actions runners,
        // where Ubuntu/AppArmor can prevent Chromium's user-namespace sandbox.
        // Headless Chromium can also stall during fixture injection while its
        // GPU process retries EGL initialization without a usable display.
        // These DOM/2D-canvas tests can use software rendering on CI; preserve
        // both sandboxing and normal graphics behavior on local machines.
        args: env.GITHUB_ACTIONS === "true" ? ["--no-sandbox", "--disable-gpu"] : []
    };
}

const launchTestBrowser = () => puppeteer.launch(browserLaunchOptions());

module.exports = { browserLaunchOptions, launchTestBrowser };