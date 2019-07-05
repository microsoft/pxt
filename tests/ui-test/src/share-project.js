
const { By } = require('selenium-webdriver');


function share() {

    it('Get in the fortest project', async () => {
        await browser.findElement(By.className('ui card  link file')).click();
        await browser.sleep(3000);
        await browser.findElement(By.className('icon share alternate large icon-and-text  ')).click();
        await browser.sleep(3000);
        await browser.findElement(By.xpath('/html/body/div[6]/div/div/div[3]/button/span')).getText().then(b => {
            assert.equal(b, 'Publish project');
            browser.sleep(3000);
        })

        await browser.findElement(By.xpath('/html/body/div[6]/div/div/div[3]/button/span')).click();
        await browser.sleep(3000);
        //Get current CSS value
        getURL = browser.findElement(By.xpath('//*[@id="projectUri"]')).getCssValue();
        assert.notEqual(getURL, "");
        await browser.sleep(3000);

        await browser.findElement(By.className('ui button icon icon-and-text ui right labeled primary icon button')).click();
        await browser.sleep(3000);
        await browser.findElement(By.className('icon close remove circle ')).click();

    })
}
exports.share = share;