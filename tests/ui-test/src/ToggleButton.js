
const { By } = require('selenium-webdriver');

function toggle() {

    it('Toggle to JavaScript', async () => {
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[2]/div/div[2]/span')).click();
        await browser.sleep(3000);
        await browser.findElement(By.xpath('//*[@id="filelist"]/div[4]/div')).getText().then(b => {
            console.assert(b, 'explorer');
        })
    })

    it('Toggle to Blcok', async () => {
        await browser.findElement(By.className('ui item link  blocks-menuitem ')).click();
        await browser.sleep(3000);
    })
}

exports.toggle = toggle;