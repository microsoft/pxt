import * as runner from "./runner";
import * as renderer from "./renderer";

/**
 * This file serves as the browserify entry point for compiling
 * pxtrunner. You probably don't want to import this file since
 * it just pollutes the global namespace. The browserified code
 * gets appended to pxtembed.js which is used in --docs, --embed,
 * --run, etc.
 */

if (!window.pxt) {
    (window as any).pxt = {};
}

(window as any).pxt.runner = {
    ...runner,
    ...renderer
}

function windowLoad() {
    let f = (window as any).ksRunnerWhenLoaded
    if (f) f();
}

windowLoad();