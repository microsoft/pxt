
import * as webdriverio from "webdriverio";
import * as chai from "chai";
import * as tests from "../commontests";

describe('Import', function () {
    const urls = [
        'https://makecode.com/_PCWEutUcRUPT',
        'https://github.com/samelhusseini/pxt-microbit-test-project',
        ''
    ]
    for (let i = 0; i < urls.length; i++) {
        it('import url', function () {
            tests.importTest({
                url: urls[i],
                shouldFail: urls[i] == ''
            } as pxt.tests.ImportTest);
        });
    }
});