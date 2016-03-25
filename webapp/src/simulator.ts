/// <reference path="../../built/kindsim.d.ts" />

import U = ks.U

interface SimulatorConfig {
    startDebug(): void;
    highlightStatement(stmt: ts.ks.LocationInfo): void;
    editor: string;
}

var driver: ks.rt.SimulatorDriver;
var nextFrameId: number = 0;
var themes = ["blue", "red", "green", "yellow"];
var currentRuntime: ks.rt.SimulatorRunMessage;
var config: SimulatorConfig;
var lastCompileResult: ts.ks.CompileResult;

var $debugger: JQuery;
var $start: JQuery;
var $stepOver: JQuery;
var $stepInto: JQuery;
var $resume: JQuery;

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
    driver = new ks.rt.SimulatorDriver($('#simulators')[0], {
        onDebuggerBreakpoint: function(brk) {
            updateDebuggerButtons(brk)
            let brkInfo = lastCompileResult.breakpoints[brk.breakpointId]
            config.highlightStatement(brkInfo)
        },
        onDebuggerResume: function() {
            config.highlightStatement(null)
            updateDebuggerButtons()
        }
    });
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

export function run(res: ts.ks.CompileResult) {
    let js = res.outfiles["microbit.js"]
    lastCompileResult = res
    driver.run(js, res.enums)
}

export function stop(unload?: boolean) {
    driver.stop(unload);
}

function updateDebuggerButtons(brk: ks.rt.DebuggerBreakpointMessage = null) {
    function btn(icon: string, name: string, label: string, click: () => void) {
        let b = $(`<button class="ui button green" title="${Util.htmlEscape(label)}">${name}</button>`)
        if (icon) b.addClass("icon").append(`<i class="${icon} icon"></i>`)
        return b.click(click)
    }
    $start = btn("", lf("Debug"), lf("Start debugging"), () => { config.startDebug() });
    $stepOver = btn("right arrow", "", lf("Step over next function call"), () => driver.resume(ks.rt.SimulatorDebuggerCommand.StepOver));
    $stepInto = btn("down arrow", "", lf("Step into next function call"), () => driver.resume(ks.rt.SimulatorDebuggerCommand.StepInto));
    $resume = btn("play", "", lf("Resume execution"), () => driver.resume(ks.rt.SimulatorDebuggerCommand.Resume));

    $debugger.empty();
    if (driver.state == ks.rt.SimulatorState.Paused) {
        $debugger.append($resume).append($stepOver)
        if (config.editor == 'tsprj')
            $debugger.append($stepInto);
    } else {
        $debugger.append($start);
    }

    if (!brk) return

    function vars(hd: string, frame: ks.rt.Variables) {
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
        let info = sf.funcInfo as ts.ks.FunctionLocationInfo
        dbgView.append(vars(info.functionName, sf.locals))
    })
    $('#debugger').append(dbgView)
}
