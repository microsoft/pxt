import { DomObject } from './lib/dom-object';
import assert from "assert";
const actions = driver.actions();

class SearchBox extends DomObject {

    async searchBox() {
        await this.sendKeys('#blocklySearchInputField', 'Basic');

    }

    test() {
        it('Get various blocks', async () => {
            return await this.searchBox();
        })
    }
}

export let searchBox = new SearchBox();