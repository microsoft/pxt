
const { By } = require('selenium-webdriver');

function search() {
    it('The search box function', async () => {
        await browser.findElement(By.id('blocklySearchInputField')).sendKeys('search');
        await browser.sleep(2000);

    })
}
exports.search = search;