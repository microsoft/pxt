import {website} from "./lib/website";
import webdriver from 'selenium-webdriver';
import newProject from './NewProject'

global.driver = new webdriver.Builder()
    .forBrowser('chrome')
    .build();

describe('Micro:bit Test', function () {
    before(function () {
        website.open("beta");
    });
    after(function () {
        website.close();
    });

    newProject.newProject();
})