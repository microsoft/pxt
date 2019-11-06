import { website } from "../lib/website";
import { newProjectPage } from '../my-projects/new-project'
import { shareProject } from "../my-projects/share-project";
import { toggleDisplayForm } from "../my-projects/toggle-editor";
import { getHelpList } from "../my-projects/help-list";
import { getMoreList } from "../my-projects/more-list";
import { editorToolBar } from "../my-projects/editor-toolbar";
import { blocklyToolBox } from "../my-projects/drag-blocks";
import { flashingHeart } from "../Tutorials/flash-heart";
import { nameTag } from "../Tutorials/name-tag";

describe('Micro:bit Test', function () {
    before(async () => {
        return await website.open("beta");
    });
    after(function () {
        website.close();
    });

    // newProjectPage.test();
    // shareProject.test();
    // toggleDisplayForm.test();
    // getHelpList.test();
    // getMoreList.test();
    // editorToolBar.test();
    // blocklyToolBox.test();
    flashingHeart.test();
    nameTag.test();
});