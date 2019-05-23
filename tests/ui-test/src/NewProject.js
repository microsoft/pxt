const { By } = require('selenium-webdriver');

function newProject() {
    it('Get the code source', async () => {
        //click New project on home page
        await browser.findElement(By.className('ui card link buttoncard newprojectcard')).click();
        await browser.sleep(8000);

        //Click home close button
        await browser.findElement(By.className('ui item link  icon openproject ')).click();
        await browser.sleep(3000);
        await browser.findElement(By.className('icon close remove circle ')).click();
        await browser.sleep(3000);

        //New project name and save it
        await browser.findElement(By.className('ui item link  icon openproject ')).click();
        await browser.sleep(3000);
        await browser.findElement(By.id('projectNameInput')).sendKeys('fortest');
        await browser.sleep(3000);

        await browser.findElement(By.className('ui button icon icon-and-text approve icon right labeled approve positive  ')).click();
        await browser.sleep(3000);
    })
    it('Get the text of localtor', async () => {
        await browser.findElement(By.xpath("//*[@id='homescreen']/div/div/div[2]/div[2]/div/div/div/div[2]/div/div[2]/div")).getText().then(b => {
            assert.equal(b, 'fortest')
        })
    })
}
exports.newProject = newProject;