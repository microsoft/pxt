const { By } = require('selenium-webdriver');

function newProject() {
    it('Get the code source', async () => {
        //click New project on home page
        await driver.findElement(By.className('ui card link buttoncard newprojectcard')).click();
        await driver.sleep(8000);

        //Click home close button
        await driver.findElement(By.className('ui item link  icon openproject ')).click();
        await driver.sleep(3000);
        await driver.findElement(By.className('icon close remove circle ')).click();
        await driver.sleep(3000);

        //New project name and save it
        await driver.findElement(By.className('ui item link  icon openproject ')).click();
        await driver.sleep(3000);
        await driver.findElement(By.id('projectNameInput')).sendKeys('fortest');
        await driver.sleep(3000);

        await driver.findElement(By.className('ui button icon icon-and-text approve icon right labeled approve positive  ')).click();
        await driver.sleep(3000);
    })
  
}

exports.newProject = newProject;