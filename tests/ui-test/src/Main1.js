global.assert = require('assert');
const {
    Builder
} = require('selenium-webdriver');
global.browser = new Builder().forBrowser('chrome').build();

var helpList = require('./HelpList');
var toggleButton = require('./ToggleButton');
var moreList = require('./MoreList');
var newProject = require('./NewProject');
var searchBox = require('./SearchBox');
var shareProject = require('./ShareProject');

describe('Micro:bit Test', async () => {
    before(async () => {
        console.log('====================================================')
        console.log('Initializing environment...')
        await browser.get('https://makecode.microbit.org/beta');
        await browser.manage().window().maximize();
        await browser.sleep(10000);
    })
    after(async () => {
        console.log('cleaning environment...')
        console.log('====================================================')
        await browser.quit()
    })
    newProject.newProject();
    shareProject.share();
    toggleButton.toggle();
    helpList.help();
    moreList.moreList();
    searchBox.search();

})