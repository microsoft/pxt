const { By } = require('selenium-webdriver');

function help() {
    it('Validate support in Help', async () => {
        await browser.findElement(By.className('ui dropdown icon item mobile hide help-dropdown-menuitem')).click();
        await browser.sleep(5000);
        //validate text Support
        await browser.findElement(By.xpath('//div[@class="menu visible transition"]/a[1]')).getText().then(b => {
            assert.equal(b, 'Support')
        })
        //validate link
        await browser.findElement(By.xpath('//div[@class="menu visible transition"]/a[1]')).getAttribute('href').then(b => {
            assert.equal(b, 'https://support.microbit.org/')
        })
        //validate new opened support window can be closed
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[1]/div/a[1]')).click();
        await browser.sleep(5000);

        let oldWindowName = "";
        let newWindowName = "";
        await browser.getAllWindowHandles().then(function (handles) {
            oldWindowName = handles[0];
            newWindowName = handles[1];
            browser.switchTo().window(newWindowName);

        });
        await browser.sleep(5000);
        await browser.getCurrentUrl().then(url => { assert.equal(url, "https://support.microbit.org/support/home"); });
        await browser.close();
        await browser.switchTo().window(oldWindowName);
        await browser.sleep(5000);

    })

    it('Should switch to Reference', async () => {
        await browser.findElement(By.className('ui dropdown icon item mobile hide help-dropdown-menuitem')).click();
        await browser.sleep(5000);

        await browser.findElement(By.xpath('//div[@class="ui item link  ui  "][1]')).getText().then(b => {
            assert.equal(b, 'Reference')
        })
        await browser.sleep(3000);

        //Open Reference 
        await browser.findElement(By.xpath('//div[@class="ui item link  ui  "][1]')).click();
        await browser.sleep(10000);
        //Switch to Reference sidedocsframe
        await browser.switchTo().frame(browser.findElement(By.id('sidedocsframe')));
        await browser.sleep(10000);

        //Open Reference in another new tab and then close it
        await browser.switchTo().defaultContent();
        await browser.findElement(By.xpath('//div[@class="ui app hide"]')).click();
        await browser.sleep(5000);

        let oldWindowName = "";
        let newWindowName = "";
        await browser.getAllWindowHandles().then(function (handles) {
            oldWindowName = handles[0];
            newWindowName = handles[1];
            browser.switchTo().window(newWindowName);

        });
        await browser.sleep(5000);
        await browser.getCurrentUrl().then(url => { assert.equal(url, "https://makecode.microbit.org/reference"); });
        await browser.close();
        await browser.switchTo().window(oldWindowName);
        await browser.sleep(5000);

    })

    it('Should switch to Blocks language', async () => {
        await browser.findElement(By.className('ui dropdown icon item mobile hide help-dropdown-menuitem')).click();
        await browser.sleep(5000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[1]/div/div[2]')).click();
        await browser.sleep(5000);
        await browser.switchTo().frame(browser.findElement(By.id('sidedocsframe')));
        await browser.findElement(By.id('blocks-language')).getText().then(b => {
            console.log(b);
            console.assert(b, 'Blocks language');
            browser.sleep(5000);
        })
        await browser.switchTo().defaultContent();
        await browser.findElement(By.className('ui app hide')).click();
        await browser.sleep(5000);

        //Open a new Tab
        let oldWindowName = "";
        let newWindowName = "";
        await browser.getAllWindowHandles().then(function (handles) {
            oldWindowName = handles[0];
            newWindowName = handles[1];
            browser.switchTo().window(newWindowName);
        });
        await browser.sleep(5000);
        await browser.getCurrentUrl().then(url => { assert.equal(url, "https://makecode.microbit.org/blocks"); });
        await browser.close();
        await browser.switchTo().window(oldWindowName);
        await browser.sleep(5000);

    })

    it('Should switch to JavaScript', async () => {
        await browser.findElement(By.className('ui dropdown icon item mobile hide help-dropdown-menuitem')).click();
        await browser.sleep(5000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[1]/div/div[3]')).click();
        await browser.sleep(5000);
        await browser.switchTo().frame(browser.findElement(By.id('sidedocsframe')));
        await browser.sleep(5000);
        await browser.findElement(By.id('javascript')).getText().then(b => {
            assert.equal(b, 'JavaScript');
            console.log(b);
            browser.sleep(5000);
        })
        await browser.switchTo().defaultContent();
        await browser.findElement(By.id('sidedocstoggle')).click();

    })
    it('Should switch to HardWare', async () => {
        await browser.findElement(By.className('ui dropdown icon item mobile hide help-dropdown-menuitem')).click();
        await browser.sleep(5000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[1]/div/div[4]')).click();
        await browser.sleep(5000);
        await browser.switchTo().frame(browser.findElement(By.id('sidedocsframe')));
        await browser.sleep(5000);
        await browser.findElement(By.id('device')).getText().then(b => {
            assert.equal(b, 'Device');
            console.log(b);
            browser.sleep(5000);
        })
        await browser.switchTo().defaultContent();
        await browser.findElement(By.className('ui app hide')).click();
        await browser.sleep(5000);

        //Open a new Tab
        let oldWindowName = "";
        let newWindowName = "";
        await browser.getAllWindowHandles().then(function (handles) {
            oldWindowName = handles[0];
            newWindowName = handles[1];
            browser.switchTo().window(newWindowName);
        });
        await browser.sleep(5000);
        await browser.getCurrentUrl().then(url => { assert.equal(url, "https://makecode.microbit.org/device"); });
        await browser.close();
        await browser.switchTo().window(oldWindowName);
        await browser.sleep(5000);

    })
    it('Should switch to Buy', async () => {
        await browser.findElement(By.className('ui dropdown icon item mobile hide help-dropdown-menuitem')).click();
        await browser.sleep(5000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[1]/div/a[2]')).click();
        await browser.sleep(5000);

        //Open a new Tab
        let oldWindowName = "";
        let newWindowName = "";
        await browser.getAllWindowHandles().then(function (handles) {
            oldWindowName = handles[0];
            newWindowName = handles[1];
            browser.switchTo().window(newWindowName);
        });
        await browser.sleep(5000);
        await browser.getCurrentUrl().then(url => { assert.equal(url, "https://microbit.org/resellers/"); });
        await browser.close();
        await browser.switchTo().window(oldWindowName);
        await browser.sleep(5000);
    })
}
exports.help = help;