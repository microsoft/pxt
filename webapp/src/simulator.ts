/// <reference path="../../built/pxtsim.d.ts" />
/// <reference path="../../localtypings/pxtparts.d.ts" />

import * as core from "./core";
import * as coretsx from "./coretsx";
import U = pxt.U

interface SimulatorConfig {
    // return true if a visible breakpoint was found
    orphanException(brk: pxsim.DebuggerBreakpointMessage): void;
    highlightStatement(stmt: pxtc.LocationInfo, brk?: pxsim.DebuggerBreakpointMessage): boolean;
    restartSimulator(): void;
    onStateChanged(state: pxsim.SimulatorState): void;
    editor: string;
}

export const FAST_TRACE_INTERVAL = 100;
export const SLOW_TRACE_INTERVAL = 500;

export let driver: pxsim.SimulatorDriver;
let nextFrameId: number = 0;
const themes = ["blue", "red", "green", "yellow"];
let config: SimulatorConfig;
let lastCompileResult: pxtc.CompileResult;
let tutorialMode: boolean;
let displayedModals: pxt.Map<boolean> = {};
export let simTranslations: pxt.Map<string>;
let dirty = false;

export function setTranslations(translations: pxt.Map<string>) {
    simTranslations = translations;
}

export function init(root: HTMLElement, cfg: SimulatorConfig) {
    if (!root) return;
    pxsim.U.clear(root);
    const simulatorsDiv = document.createElement('div');
    simulatorsDiv.id = 'simulators';
    simulatorsDiv.className = 'simulator';
    root.appendChild(simulatorsDiv);
    const debuggerDiv = document.createElement('div');
    debuggerDiv.id = 'debugger';
    debuggerDiv.className = 'ui item landscape only';
    root.appendChild(debuggerDiv);

    let options: pxsim.SimulatorDriverOptions = {
        revealElement: (el) => {
            if (pxt.options.light) return;
            // Play enter animation
            const animation = pxt.appTarget.appTheme.simAnimationEnter || 'fly right in';
            el.style.animationDuration = '500ms';
            const animationClasses = `${animation} visible transition animating`;
            pxsim.U.addClass(el, animationClasses);

            Promise.resolve().delay(500).then(() => {
                pxsim.U.removeClass(el, animationClasses);
                el.style.animationDuration = '';

                if (pxt.BrowserUtils.isEdge() && coretsx.dialogIsShowing()) {
                    // Workaround for a Microsoft Edge bug where when a dialog is open and the simulator is
                    // revealed it somehow breaks the page render. See https://github.com/Microsoft/pxt/pull/4707
                    // for more details

                    document.body.style.display = "none";
                    requestAnimationFrame(() => {
                        document.body.style.display = "block";
                    });
                }
            })
        },
        removeElement: (el, completeHandler) => {
            if (pxt.appTarget.simulator.headless) {
                pxsim.U.addClass(el, 'simHeadless');
                if (completeHandler) completeHandler();
            }
            else {
                if (pxt.options.light) {
                    if (completeHandler) completeHandler();
                    pxsim.U.remove(el);
                    return;
                }
                // Play exit animation
                const animation = pxt.appTarget.appTheme.simAnimationExit || 'fly right out';
                el.style.animationDuration = '500ms';
                const animationClasses = `${animation} visible transition animating`;
                pxsim.U.addClass(el, animationClasses);
                Promise.resolve().delay(500).then(() => {
                    pxsim.U.removeClass(el, `animating`);
                    el.style.animationDuration = '';

                    if (completeHandler) completeHandler();
                    pxsim.U.remove(el);
                })
            }
        },
        unhideElement: (el) => {
            pxsim.U.removeClass(el, "simHeadless");
        },
        onDebuggerBreakpoint: function (brk) {
            // walk stack until breakpoint is found
            // and can be highlighted
            let highlighted = false;
            if (config) {
                let frameid = 0;
                let brkid = brk.breakpointId;
                while (!highlighted) {
                    // try highlight current statement
                    if (brkid) {
                        const brkInfo = lastCompileResult.breakpoints[brkid];
                        highlighted = config.highlightStatement(brkInfo, brk);
                    }
                    // try next frame
                    if (!highlighted) {
                        frameid++;
                        const frame = brk.stackframes ? brk.stackframes[frameid] : undefined;
                        // no more frames, done
                        if (!frame) break;
                        brkid = frame.breakpointId;
                    }
                }
            }
            // no exception and no highlighting, keep going
            if (!brk.exceptionMessage && config && !highlighted) {
                // keep going until breakpoint is hit
                driver.resume(pxsim.SimulatorDebuggerCommand.StepInto);
                return;
            }
            // we had an expected but could not find a block
            if (!highlighted && brk.exceptionMessage) {
                pxt.debug(`runtime error: ${brk.exceptionMessage}`);
                pxt.debug(brk.exceptionStack);
                if (config) config.orphanException(brk);
            }
            postSimEditorEvent("stopped", brk.exceptionMessage);
        },
        onTraceMessage: function (msg) {
            let brkInfo = lastCompileResult.breakpoints[msg.breakpointId]
            if (config) config.highlightStatement(brkInfo)
        },
        onDebuggerWarning: function (wrn) {
            for (let id of wrn.breakpointIds) {
                let brkInfo = lastCompileResult.breakpoints[id]
                if (brkInfo) {
                    if (!U.startsWith("pxt_modules/", brkInfo.fileName)) {
                        if (config) config.highlightStatement(brkInfo)
                        break
                    }
                }
            }
        },
        onDebuggerResume: function () {
            postSimEditorEvent("resumed");
            if (config) config.highlightStatement(null)
        },
        onStateChanged: function (state) {
            if (state === pxsim.SimulatorState.Stopped) {
                postSimEditorEvent("stopped");
            } else if (state === pxsim.SimulatorState.Running) {
                this.onDebuggerResume();
            }
            cfg.onStateChanged(state);
        },
        onSimulatorCommand: (msg: pxsim.SimulatorCommandMessage): void => {
            switch (msg.command) {
                case "restart":
                    cfg.restartSimulator();
                    break;
                case "reload":
                    stop(true);
                    cfg.restartSimulator();
                    break;
                case "modal":
                    stop();
                    if (!pxt.shell.isSandboxMode() && (!msg.displayOnceId || !displayedModals[msg.displayOnceId])) {
                        const modalOpts: core.ConfirmOptions = {
                            header: msg.header,
                            body: msg.body,
                            size: "large",
                            copyable: msg.copyable,
                            disagreeLbl: lf("Close"),
                            modalContext: msg.modalContext
                        };
                        const trustedSimUrls = pxt.appTarget.simulator.trustedUrls;
                        const hasTrustedLink = msg.linkButtonHref && trustedSimUrls && trustedSimUrls.indexOf(msg.linkButtonHref) !== -1;

                        if (hasTrustedLink) {
                            modalOpts.agreeLbl = msg.linkButtonLabel;
                        } else {
                            modalOpts.hideAgree = true;
                        }

                        displayedModals[msg.displayOnceId] = true;
                        core.confirmAsync(modalOpts)
                            .then((selection) => {
                                if (hasTrustedLink && selection == 1) {
                                    window.open(msg.linkButtonHref, '_blank');
                                }
                            })
                            .done();
                    }
                    break;
            }
        },
        onTopLevelCodeEnd: () => {
            postSimEditorEvent("toplevelfinished");
        },
        stoppedClass: getStoppedClass()
    };
    driver = new pxsim.SimulatorDriver(document.getElementById('simulators'), options);
    config = cfg
}

function postSimEditorEvent(subtype: string, exception?: string) {
    if (pxt.appTarget.appTheme.allowParentController && pxt.BrowserUtils.isIFrame()) {
        pxt.editor.postHostMessageAsync({
            type: "pxthost",
            action: "simevent",
            subtype: subtype as any,
            exception: exception
        } as pxt.editor.EditorSimulatorStoppedEvent);
    }
}

export function setState(editor: string, tutMode?: boolean) {
    if (config && config.editor != editor) {
        config.editor = editor;
        config.highlightStatement(null)
    }

    tutorialMode = tutMode;
}

export function makeDirty() { // running outdated code
    pxsim.U.addClass(driver.container, getInvalidatedClass());
    dirty = true;

    // We suspend the simulator here to stop it from running without
    // interfering with the user's stopped state. We're not doing this check
    // in the driver because the driver should be able to switch from any state
    // to the suspend state, but in this codepath we only want to switch to the
    // suspended state if we're running
    if (driver.state == pxsim.SimulatorState.Running) driver.suspend();
}

export function isDirty(): boolean { // in need of a restart?
    return dirty;
}

export function run(pkg: pxt.MainPackage, debug: boolean,
    res: pxtc.CompileResult, mute?: boolean,
    highContrast?: boolean, light?: boolean,
    clickTrigger?: boolean) {
    makeClean();
    const js = res.outfiles[pxtc.BINARY_JS]
    const boardDefinition = pxt.appTarget.simulator.boardDefinition;
    const parts = pxtc.computeUsedParts(res, true);
    const fnArgs = res.usedArguments;
    lastCompileResult = res;

    const opts: pxsim.SimulatorRunOptions = {
        boardDefinition: boardDefinition,
        mute,
        parts,
        debug,
        fnArgs,
        highContrast,
        light,
        aspectRatio: parts.length ? pxt.appTarget.simulator.partsAspectRatio : pxt.appTarget.simulator.aspectRatio,
        partDefinitions: pkg.computePartDefinitions(parts),
        cdnUrl: pxt.webConfig.commitCdnUrl,
        localizedStrings: simTranslations,
        refCountingDebug: pxt.options.debug,
        version: pkg.version(),
        clickTrigger: clickTrigger
    }
    postSimEditorEvent("started");

    driver.run(js, opts);
}

export function mute(mute: boolean) {
    driver.mute(mute);
}

export function stop(unload?: boolean) {
    if (!driver) return;

    makeClean();
    driver.stop(unload);
}

export function suspend() {
    if (!driver) return;

    makeClean();
    driver.suspend();
}

export function hide(completeHandler?: () => void) {
    if (!pxt.appTarget.simulator.headless) {
        makeDirty();
    }
    driver.hide(completeHandler);
}

export function unhide() {
    driver.unhide();
}

export function setTraceInterval(intervalMs: number) {
    driver.setTraceInterval(intervalMs);
}

export function proxy(message: pxsim.SimulatorCustomMessage) {
    if (!driver) return;

    driver.postMessage(message);
}

export function dbgPauseResume() {
    if (driver.state == pxsim.SimulatorState.Paused) {
        driver.resume(pxsim.SimulatorDebuggerCommand.Resume);
    } else if (driver.state == pxsim.SimulatorState.Running) {
        driver.resume(pxsim.SimulatorDebuggerCommand.Pause);
    }
}

export function dbgStepOver() {
    if (driver.state == pxsim.SimulatorState.Paused) {
        driver.resume(pxsim.SimulatorDebuggerCommand.StepOver);
    }
}

export function dbgStepInto() {
    if (driver.state == pxsim.SimulatorState.Paused) {
        driver.resume(pxsim.SimulatorDebuggerCommand.StepInto);
    }
}

export function dbgStepOut() {
    if (driver.state == pxsim.SimulatorState.Paused) {
        driver.resume(pxsim.SimulatorDebuggerCommand.StepOut);
    }
}

function makeClean() {
    pxsim.U.removeClass(driver.container, getInvalidatedClass());
    dirty = false;
}

function getInvalidatedClass() {
    if (pxt.appTarget.simulator && pxt.appTarget.simulator.invalidatedClass) {
        return pxt.appTarget.simulator.invalidatedClass;
    }
    return "sepia";
}

function getStoppedClass() {
    if (pxt.appTarget.simulator && pxt.appTarget.simulator.stoppedClass) {
        return pxt.appTarget.simulator.stoppedClass;
    }
    return undefined;
}
