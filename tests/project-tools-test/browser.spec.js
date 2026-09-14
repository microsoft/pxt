"use strict";

const assert = require("assert");
const { browserLaunchOptions } = require("./browser");

describe("project-tools browser launch policy", () => {
    it("keeps Chromium sandboxed on local runs", () => {
        assert.deepEqual(browserLaunchOptions({}), { headless: true, args: [] });
        assert.deepEqual(browserLaunchOptions({ GITHUB_ACTIONS: "false" }).args, []);
        assert.deepEqual(browserLaunchOptions({ CI: "true" }).args, []);
    });

    it("matches the no-sandbox Karma policy only on GitHub Actions", () => {
        assert.deepEqual(browserLaunchOptions({ GITHUB_ACTIONS: "true" }), {
            headless: true, args: ["--no-sandbox"]
        });
    });
});