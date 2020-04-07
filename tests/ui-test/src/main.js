import { website } from "./lib/website";
import webdriver from 'selenium-webdriver';
import { chrome } from 'selenium-webdriver/chrome';

import { newProjectPage } from './new-project'

describe('Micro:bit Test', function () {
    before(async () => {
        return await website.open("beta");
    });
    after(function () {
        website.close();
    });

    newProjectPage.test();
});