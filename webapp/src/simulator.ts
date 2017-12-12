/// <reference path="../../built/pxtsim.d.ts" />
/// <reference path="../../localtypings/pxtparts.d.ts" />

import * as core from "./core";
import U = pxt.U

interface SimulatorConfig {
    highlightStatement(stmt: pxtc.LocationInfo): void;
    restartSimulator(): void;
    editor: string;
}

export const FAST_TRACE_INTERVAL = 100;
export const SLOW_TRACE_INTERVAL = 500;

export var driver: pxsim.SimulatorDriver;
let nextFrameId: number = 0;
const themes = ["blue", "red", "green", "yellow"];
let config: SimulatorConfig;
let lastCompileResult: pxtc.CompileResult;
let tutorialMode: boolean;
let displayedModals: pxt.Map<boolean> = {};
export let simTranslations: pxt.Map<string>;
let dirty = false;

let $debugger: JQuery;

export function init(root: HTMLElement, cfg: SimulatorConfig) {
    $(root).html(
        `
        <div id="simulators" class='simulator'>
        </div>
        <div id="debugger" class="ui item landscape only">
        </div>
        `
    )
    $debugger = $('#debugger')
    let options: pxsim.SimulatorDriverOptions = {
        revealElement: (el) => {
            ($(el) as any).transition({
                animation: pxt.appTarget.appTheme.simAnimationEnter || 'fly right in',
                duration: '0.5s',
            })
        },
        removeElement: (el, completeHandler) => {
            if (pxt.appTarget.simulator.headless) {
                $(el).addClass('simHeadless');
                completeHandler();
            }
            else {
                ($(el) as any).transition({
                    animation: pxt.appTarget.appTheme.simAnimationExit || 'fly right out',
                    duration: '0.5s',
                    onComplete: function () {
                        if (completeHandler) completeHandler();
                        $(el).remove();
                    }
                }).error(() => {
                    // Problem with animation, still complete
                    if (completeHandler) completeHandler();
                    $(el).remove();
                })
            }
        },
        unhideElement: (el) => {
            $(el).removeClass("simHeadless");
        },
        onDebuggerBreakpoint: function (brk) {
            updateDebuggerButtons(brk)
            let brkInfo = lastCompileResult.breakpoints[brk.breakpointId]
            if (config) config.highlightStatement(brkInfo)
            if (brk.exceptionMessage) {
                core.errorNotification(lf("Program Error: {0}", brk.exceptionMessage))
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
            updateDebuggerButtons()
        },
        onStateChanged: function (state) {
            if (state === pxsim.SimulatorState.Stopped) {
                postSimEditorEvent("stopped");
            }
            updateDebuggerButtons()
        },
        onSimulatorCommand: (msg: pxsim.SimulatorCommandMessage): void => {
            switch (msg.command) {
                case "restart":
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
                                    window.open(msg.linkButtonHref,'_blank');
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
    driver = new pxsim.SimulatorDriver($('#simulators')[0], options);
    config = cfg
    updateDebuggerButtons();
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
        updateDebuggerButtons();
    }

    tutorialMode = tutMode;
}

export function makeDirty() { // running outdated code
    pxsim.U.addClass(driver.container, getInvalidatedClass());
    dirty = true;
}

export function isDirty(): boolean { // in need of a restart?
    return dirty;
}

export function run(pkg: pxt.MainPackage, debug: boolean, res: pxtc.CompileResult, mute?: boolean, highContrast?: boolean) {
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
        aspectRatio: parts.length ? pxt.appTarget.simulator.partsAspectRatio : pxt.appTarget.simulator.aspectRatio,
        partDefinitions: pkg.computePartDefinitions(parts),
        cdnUrl: pxt.webConfig.commitCdnUrl,
        localizedStrings: simTranslations,
        refCountingDebug: pxt.options.debug
    }
    postSimEditorEvent("started");

    driver.run(js, opts);
}

export function mute(mute: boolean) {
    driver.mute(mute);
    $debugger.empty();
}

export function stop(unload?: boolean) {
    if (!driver) return;

    makeClean();
    driver.stop(unload);
    $debugger.empty();
}

export function hide(completeHandler?: () => void) {
    if (!pxt.appTarget.simulator.headless) {
        makeDirty();
    }
    driver.hide(completeHandler);
    $debugger.empty();
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
    $debugger.empty();
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

function updateDebuggerButtons(brk: pxsim.DebuggerBreakpointMessage = null) {
    function btn(icon: string, name: string, label: string, click: () => void) {
        let b = $(`<button class="ui mini button teal" title="${Util.htmlEscape(label)}"></button>`)
        if (icon) b.addClass("icon").append(`<i class="${icon} icon"></i>`)
        if (name) b.append(Util.htmlEscape(name));
        return b.click(click)
    }

    $debugger.empty();
    if (!driver.runOptions.debug) return;
    let advanced = config.editor == 'tsprj';

    if (driver.state == pxsim.SimulatorState.Paused) {
        let $resume = btn("play", lf("Resume"), lf("Resume execution"), () => driver.resume(pxsim.SimulatorDebuggerCommand.Resume));
        let $stepOver = btn("xicon stepover", lf("Step over"), lf("Step over next function call"), () => driver.resume(pxsim.SimulatorDebuggerCommand.StepOver));
        let $stepInto = btn("xicon stepinto", lf("Step into"), lf("Step into next function call"), () => driver.resume(pxsim.SimulatorDebuggerCommand.StepInto));
        $debugger.append($resume).append($stepOver)
        if (advanced)
            $debugger.append($stepInto);
    } else if (driver.state == pxsim.SimulatorState.Running) {
        let $pause = btn("pause", lf("Pause"), lf("Pause execution on the next instruction"), () => driver.resume(pxsim.SimulatorDebuggerCommand.Pause));
        $debugger.append($pause);
    }

    if (!brk || !advanced) return

    function vars(hd: string, frame: pxsim.Variables) {
        let frameView = $(`<div><h4>${U.htmlEscape(hd)}</h4></div>`)
        for (let k of Object.keys(frame)) {
            let v = frame[k]
            let sv = ""
            switch (typeof (v)) {
                case "number": sv = v + ""; break;
                case "string": sv = JSON.stringify(v); break;
                case "object":
                    if (v == null) sv = "null";
                    else if (v.id !== undefined) sv = "(object)"
                    else if (v.text) sv = v.text;
                    else sv = "(unknown)"
                    break;
                default: U.oops()
            }
            let n = k.replace(/___\d+$/, "")
            frameView.append(`<div>${U.htmlEscape(n)}: ${U.htmlEscape(sv)}</div>`)
        }
        return frameView
    }

    let dbgView = $(`<div class="ui segment debuggerview"></div>`)
    dbgView.append(vars(U.lf("globals"), brk.globals))
    brk.stackframes.forEach(sf => {
        let info = sf.funcInfo as pxtc.FunctionLocationInfo
        dbgView.append(vars(info.functionName, sf.locals))
    })
    $('#debugger').append(dbgView)
}
