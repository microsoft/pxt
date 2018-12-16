
import * as webdriverio from "webdriverio";
import * as chai from "chai";
import * as commontests from "../commontests";

describe('Tutorials', function () {
    const tutorials = [
        'projects/flashing-heart',
        'projects/name-tag',
        'projects/smiley-buttons',
        'projects/dice',
        'projects/love-meter',
        'projects/micro-chat',
        'projects/rock-paper-scissors',
        'projects/coin-flipper',
        'projects/snap-the-dot',
        'projects/turtle-square',
        'projects/multi-dice'
    ]
    for (let i = 0; i < tutorials.length; i++) {
        it('load tutorial', function () {
            commontests.tutorialTest({
                path: tutorials[i]
            } as pxt.tests.TutorialTest);
        });
    }
});