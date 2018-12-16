
import * as webdriverio from "webdriverio";
import * as chai from "chai";
import * as U from "../testutils";

describe('Accessibility', function () {
    it('accessible menu shows up from home screen', function () {
        U.loadHome({});

        // Send a tab key, to view the accessible menu, extra two to skip the cookie banner..
        browser.keys(['\uE004']);
        browser.keys(['\uE004']);
        browser.keys(['\uE004']);
        if (browser.desiredCapabilities.browserName == 'internet explorer') {
            browser.keys(['\uE004']);
            browser.keys(['\uE004']);
        }
        browser.pause(100);

        // Check the accessible menu appears
        chai.assert(browser.isVisible('.ui.home .ui.accessibleMenu'), "Not visible");
    });
});
