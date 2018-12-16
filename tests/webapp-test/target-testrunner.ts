/* tslint:disable:non-literal-require */
/// <reference path="../../localtypings/pxttest.d.ts"/>

import * as fs from "fs";
import * as webdriverio from "webdriverio";
import * as chai from "chai";

import * as tests from "./commontests";

const targetdir = process.cwd();
const releaseconfig: pxt.tests.ReleaseTestConfig =
    require(targetdir + "/release-tests.conf.js").config;

for (let i = 0; i < releaseconfig.tests.length; i++) {
    const test = releaseconfig.tests[i];
    // Apply common properties
    if (!test.lang) test.lang = releaseconfig.lang || 'en';
    test.basePath = releaseconfig.basePath;
    switch (test.type) {
        case 'import':
            const importTest = test as pxt.tests.ImportTest;
            describe('Import test', function () {
                it(`run ${importTest.name || 'Untitled'}`, function () {
                    tests.importTest(importTest); //, importTest.url, importTest.shouldFail || false);
                });
            });
            break;
        case 'tutorial':
            const tutorialTest = test as pxt.tests.TutorialTest;
            describe('Tutorial test', function () {
                it(`run ${tutorialTest.name || 'Untitled'}`, function () {
                    tests.tutorialTest(tutorialTest);
                });
            });
            break;
        case 'blockly':
            const blocklyTest = test as pxt.tests.BlocklyTest;
            switch (blocklyTest.action) {
                case 'search':
                    describe('Blockly search test', function () {
                        it(`run ${blocklyTest.name || 'Untitled'}`, function () {
                            tests.blockSearchTest(blocklyTest);
                        });
                    });
                    break;
            }
            break;
    }
}

afterEach(() => {
    // Ensure there's a browser refresh after every test
    browser.refresh();
})
