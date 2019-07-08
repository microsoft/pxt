import { website } from "./lib/website";
import { newProjectPage } from './new-project'
import { shareProject } from "./share-project";

describe('Micro:bit Test', function () {
    before(async () => {
        return await website.open("beta");
    });
    after(function () {
        website.close();
    });

    newProjectPage.test();
    shareProject.test();
})