"use strict";

const assert = require("assert");
const { browserLaunchOptions } = require("./browser");

describe("project-tools browser launch policy", () => {
    it("uses CI-only Chromium workarounds and retains a bounded protocol deadline", () => {
        assert.deepEqual(browserLaunchOptions({}), { headless: true, protocolTimeout: 10000, args: [] });
        assert.deepEqual(browserLaunchOptions({ GITHUB_ACTIONS: "false" }).args, []);
        assert.deepEqual(browserLaunchOptions({ CI: "true" }).args, []);
        assert.deepEqual(browserLaunchOptions({ GITHUB_ACTIONS: "true" }), {
            headless: true, protocolTimeout: 10000, args: ["--no-sandbox", "--disable-gpu"]
        });
    });
});