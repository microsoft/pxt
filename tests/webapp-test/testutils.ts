
export let accessibleMenuSelector = '.ui.home .ui.accessibleMenu';
export let brandLogoSelector = '.ui.home .ui.item.logo.brand';

export function loadHome(props: pxt.tests.TestProperties) {
    loadWebApp(props);
    browser.pause(2000);
}

export function loadTutorial(props: pxt.tests.TestProperties, tutorialPath: string) {
    loadWebApp(props, false, 'tutorial:' + tutorialPath);
}

export function loadBlocks(props: pxt.tests.TestProperties, pub?: string) {
    loadWebApp(props, true, (pub ? 'pub:' + pub : undefined));
    waitForDimmers();
}

function loadWebApp(props: pxt.tests.TestProperties, editor?: boolean, hash?: string) {
    const forceLang = props.lang != 'en' ? props.lang : '';
    let queryParams = 'automated=1';
    if (forceLang) queryParams += `&forceLang=${forceLang}`;

    const hashParams = hash ? hash : (editor ? 'editor' : '');
    browser
        .url(`${props.basePath || '/?automated=1'}${queryParams ?
            `${props.basePath.indexOf('?') != -1 ? '&' : '?'}${queryParams}` : ''}${hashParams ? `#${hashParams}` : ''}`)
    waitForMainLoader();
}


export function waitForMainLoader() {
    // Wait for any dimmers on the screen to complete
    browser
        .waitUntil(() => {
            return !browser.isExisting('.ui.main.loader');
        });
}

export function waitForDimmers() {
    // Wait for any dimmers on the screen to complete
    browser
        .waitUntil(() => {
            return !browser.isExisting('.dimmer');
        });
}

export function waitForSimulator() {
    browser
        .waitUntil(() => {
            return browser.isExisting('#simulators .simframe');
        });
}

export function verifyInEditor() {
    return !browser.isExisting('.ui.home');
}

// Blockly specific functionality

declare let Blockly: any;

export function numberOfBlocks() {
    return browser.execute(function() {
        return Blockly.mainWorkspace.getTopBlocks().length;
    }).value;
}

export function rightClick(selector: string, x: number, y: number) {
    browser.moveToObject(selector, x, y);
    browser.buttonDown(2);
    browser.buttonUp(2);
}