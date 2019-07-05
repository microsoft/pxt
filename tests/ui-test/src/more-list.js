const { By } = require('selenium-webdriver');
const util = require('util')
const fs = require('fs')
const writeFile = util.promisify(fs.writeFile)

function moreList() {

    it('Should switch to Project Settings', async () => {
        await browser.findElement(By.className('ui dropdown icon item icon more-dropdown-menuitem')).click();
        await browser.sleep(5000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[2]/div/div[1]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.id("fileNameInput")).getAttribute('value').then(b => {
            assert.equal(b, 'fortest')
        })
        //Update project name
        await browser.findElement(By.id("fileNameInput")).sendKeys("Micro:bit");
        await browser.sleep(5000);
        await browser.findElement(By.className('ui button  green ')).click();
        await browser.sleep(5000);

    })

    it('Should switch to Extensions', async () => {
        await browser.findElement(By.xpath('//div[contains(@class,"more-dropdown-menuitem")]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[2]/div/div[2]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.className('ui button back-button large')).click();
        await browser.sleep(3000);
    })


    it('Should switch to delete project and cancel delete', async () => {
        await browser.findElement(By.xpath('//div[contains(@class,"more-dropdown-menuitem")]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[2]/div/div[4]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.className('ui button icon icon-and-text approve icon right labeled cancel  ')).click();
        await browser.sleep(3000);
        await browser.getCurrentUrl().then(url => {
            assert.equal(url, "https://makecode.microbit.org/beta#editor");
        });

    })

    it('Should switch to delete project and delete current project', async () => {
        await browser.findElement(By.xpath('//div[contains(@class,"more-dropdown-menuitem")]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[2]/div/div[4]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.className('ui button icon icon-and-text approve icon right labeled red  ')).click();
        await browser.sleep(5000);
        await browser.getCurrentUrl().then(url => {
            assert.equal(url, "https://makecode.microbit.org/beta#");
        });
        await browser.sleep(3000);
        await browser.findElement(By.className('ui card link buttoncard newprojectcard')).click();
        await browser.sleep(10000);
    })

    it('Should switch to Report Abuse...', async () => {
        await browser.findElement(By.xpath('//div[contains(@class,"more-dropdown-menuitem")]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[2]/div/div[5]')).click();
        await browser.sleep(3000);

        await browser.findElement(By.xpath('/html/body/div[12]/div/div/div[3]/button[2]')).click();
    })

    it('Should switch to language', async () => {
        await browser.findElement(By.xpath('//div[contains(@class,"more-dropdown-menuitem")]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[2]/div/div[7]')).click();
        await browser.sleep(5000);
        await browser.findElement(By.xpath('//div[@class="ui card  link card-selected"][25]')).click();
        await browser.sleep(10000);

    })

    it('Should switch to open high contrast', async () => {
        await browser.findElement(By.xpath('//div[contains(@class,"more-dropdown-menuitem")]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[2]/div/div[8]')).click();
        browser.takeScreenshot().then(
            function (image, err) {
                writeFile('./screenshot/openHighContrast.png', image, 'base64', function (err) {
                    console.log(err);
                });
            }
        );
        await browser.sleep(3000);

    })

    it('Should switch to close high contrast', async () => {
        await browser.findElement(By.xpath('//div[contains(@class,"more-dropdown-menuitem")]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[2]/div/div[8]')).click();
        browser.takeScreenshot().then(
            function (image, err) {
                writeFile('./screenshot/closeHighContrast.png', image, 'base64', function (err) {
                    console.log(err);
                });
            }
        );
        await browser.sleep(3000);
    })

    it('Should switch to open green screen', async () => {
        await browser.findElement(By.xpath('//div[contains(@class,"more-dropdown-menuitem")]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[2]/div/div[9]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.className('icon green tint massive ')).click();
        await browser.sleep(3000);
        browser.takeScreenshot().then(
            function (image, err) {
                writeFile('./screenshot/openGreenScreen.png', image, 'base64', function (err) {
                    console.log(err);
                });
            }
        );
        await browser.sleep(3000);
    })

    it('Should switch to close green screen', async () => {
        await browser.findElement(By.xpath('//div[contains(@class,"more-dropdown-menuitem")]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[2]/div/div[9]')).click();
        await browser.sleep(3000);
        browser.takeScreenshot().then(
            function (image, err) {
                writeFile('./screenshot/closeGreenScreen.png', image, 'base64', function (err) {
                    console.log(err);
                });
            }
        );
        await browser.sleep(3000);
    })

    it('Should switch to reset and cancel reset', async () => {
        await browser.findElement(By.xpath('//div[contains(@class,"more-dropdown-menuitem")]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[2]/div/div[10]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.className('ui button icon icon-and-text approve icon right labeled cancel  ')).click();
        await browser.sleep(3000);
        await browser.getCurrentUrl().then(url => {
            assert.equal(url, "https://makecode.microbit.org/beta#editor");
        });
        await browser.sleep(3000);
    })

    it('Should switch to reset and confirm reset', async () => {
        await browser.findElement(By.xpath('//div[contains(@class,"more-dropdown-menuitem")]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[2]/div/div[10]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.className('ui button icon icon-and-text approve icon right labeled red  ')).click();
        await browser.sleep(3000);
        await browser.getCurrentUrl().then(url => {
            assert.equal(url, "https://makecode.microbit.org/beta#reload");
        });
        await browser.sleep(3000);
        await browser.findElement(By.className('ui card link buttoncard newprojectcard')).click();
        await browser.sleep(10000);
    })

    it('Check About info', async () => {
        await browser.findElement(By.xpath('//div[contains(@class,"more-dropdown-menuitem")]')).click();
        await browser.sleep(3000);
        await browser.findElement(By.xpath('//*[@id="mainmenu"]/div[3]/div[2]/div/div[18]')).click();
        await browser.sleep(3000);
        browser.takeScreenshot().then(
            function (image, err) {
                writeFile('./screenshot/aboutInfo.png', image, 'base64', function (err) {
                    console.log(err);
                });
            }
        );
        await browser.sleep(3000);
        await browser.findElement(By.className('ui button icon icon-and-text approve icon right labeled positive  ')).click();
        await browser.sleep(3000);
    })
}

exports.moreList = moreList;