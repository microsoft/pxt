"use strict";

const puppeteer = require("puppeteer");

function browserLaunchOptions(env = process.env) {
    return {
        headless: true,
        // Match the existing Karma launcher on isolated GitHub Actions runners,
        // where Ubuntu/AppArmor can prevent Chromium's user-namespace sandbox.
        // Never disable the sandbox implicitly on local developer machines.
        args: env.GITHUB_ACTIONS === "true" ? ["--no-sandbox"] : []
    };
}

const launchTestBrowser = () => puppeteer.launch(browserLaunchOptions());

module.exports = { browserLaunchOptions, launchTestBrowser };