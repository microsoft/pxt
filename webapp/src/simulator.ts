/// <reference path="../../built/pxtsim.d.ts" />

import U = pxt.U

interface SimulatorConfig {
    highlightStatement(stmt: pxtc.LocationInfo): void;
    editor: string;
    onCompile(name: string, content: string, contentType: string): void;
}

export var driver: pxsim.SimulatorDriver;
let nextFrameId: number = 0;
const themes = ["blue", "red", "green", "yellow"];
let currentRuntime: pxsim.SimulatorRunMessage;
let config: SimulatorConfig;
let lastCompileResult: pxtc.CompileResult;

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
                animation: 'fly right in',
                duration: '0.5s',
            })
        },
        removeElement: (el) => {
            ($(el) as any).transition({
                animation: 'fly right out',
                duration: '0.5s',
                onComplete: function () {
                    $(el).remove();
                }
            })
        },
        onDebuggerBreakpoint: function (brk) {
            updateDebuggerButtons(brk)
            let brkInfo = lastCompileResult.breakpoints[brk.breakpointId]
            config.highlightStatement(brkInfo)
        },
        onDebuggerResume: function () {
            config.highlightStatement(null)
            updateDebuggerButtons()
        },
        onStateChanged: function (state) {
            updateDebuggerButtons()
        },
        onCompile: cfg.onCompile
    };
    if (pxt.appTarget.simulator)
        options.aspectRatio = pxt.appTarget.simulator.aspectRatio;
    driver = new pxsim.SimulatorDriver($('#simulators')[0], options);
    config = cfg
    updateDebuggerButtons();
}

export function setState(editor: string) {
    if (config.editor != editor) {
        config.editor = editor;
        config.highlightStatement(null)
        updateDebuggerButtons();
    }
}

export function makeDirty() { // running outdated code
    pxsim.U.addClass(driver.container, "sepia");
}

export function isDirty(): boolean { // in need of a restart?
    return /sepia/.test(driver.container.className);
}

export function run(debug: boolean, res: pxtc.CompileResult) {
    pxsim.U.removeClass(driver.container, "sepia");
    let js = res.outfiles[pxtc.BINARY_JS]
    let parts = pxtc.computeUsedParts(res);
    let fnArgs = res.usedArguments;
    lastCompileResult = res;
    driver.run(js, {parts: parts, debug: debug, fnArgs: fnArgs});
}

export function stop(unload?: boolean) {
    pxsim.U.removeClass(driver.container, "sepia");
    driver.stop(unload);
    $debugger.empty();
}

function updateDebuggerButtons(brk: pxsim.DebuggerBreakpointMessage = null) {
    function btn(icon: string, name: string, label: string, click: () => void) {
        let b = $(`<button class="ui mini button teal" title="${Util.htmlEscape(label)}"></button>`)
        if (icon) b.addClass("icon").append(`<i class="${icon} icon"></i>`)
        if (name) b.append(Util.htmlEscape(name));
        return b.click(click)
    }

    $debugger.empty();
    if (!driver.debug) return;
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
