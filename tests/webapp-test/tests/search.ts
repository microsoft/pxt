
import * as webdriverio from "webdriverio";
import * as chai from "chai";
import * as commontests from "../commontests";

declare let Blockly: any;

describe('Editor search', function () {
    it('can find search results', function () {
        commontests.blockSearchTest({
            data: {
                term: "repeat"
            }
        } as pxt.tests.BlocklyTest);
    });
});
