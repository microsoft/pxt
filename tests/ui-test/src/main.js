import { website } from "./lib/website";
import { newProjectPage } from './new-project'
import { shareProject } from "./share-project";
import { toggleButton } from "./toggle-button";
import { getHelpList } from "./help-list";
import { getMoreList } from "./more-list";
import { viewMenuBar } from "./menubar";
import { blocklyToolBox } from "./search-box";
describe('Micro:bit Test', function () {
    before(async () => {
        return await website.open("beta");
    });
    after(function () {
        website.close();
    });

    newProjectPage.test();
    // shareProject.test();
    // toggleButton.test();
    getHelpList.test();
    // getMoreList.test();
    // viewMenuBar.test();
    // blocklyToolBox.test();
});