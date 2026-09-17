"use strict";

const assert = require("assert");
const { browserLaunchOptions } = require("./browser");

describe("project-tools browser launch policy", () => {
    it("keeps Chromium sandboxed with normal graphics on local runs", () => {
        assert.deepEqual(browserLaunchOptions({}), { headless: true, protocolTimeout: 10000, args: [] });
        assert.deepEqual(browserLaunchOptions({ GITHUB_ACTIONS: "false" }).args, []);
        assert.deepEqual(browserLaunchOptions({ CI: "true" }).args, []);
    });

    it("uses the sandbox workaround and software rendering only on GitHub Actions", () => {
        assert.deepEqual(browserLaunchOptions({ GITHUB_ACTIONS: "true" }), {
            headless: true, protocolTimeout: 10000, args: ["--no-sandbox", "--disable-gpu"]
        });
    });

    it("reports stalled protocol commands before Mocha's hook deadline", () => {
        for (const env of [{}, { GITHUB_ACTIONS: "true" }]) {
            const { protocolTimeout } = browserLaunchOptions(env);
            assert.ok(protocolTimeout > 0 && protocolTimeout < 30000);
        }
    });
});