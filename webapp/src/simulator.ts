/// <reference path="../../built/kindsim.d.ts" />

import U = ks.U

interface SimulatorConfig {
    startDebug(): void;
    highlightStatement(stmt: ts.ks.LocationInfo): void;
}

var nextFrameId: number = 0;
var themes = ["blue", "red", "green", "yellow"];
var currentRuntime: ks.rt.SimulatorRunMessage;
var isPaused = false;
var config: SimulatorConfig;
var lastCompileResult: ts.ks.CompileResult;

export function init(root: HTMLElement, cfg: SimulatorConfig) {
    config = cfg
    $(root).html(
        `
        <div id="simulators" class='simulator'>
        </div>
        <div id="debugger" class="ui item landscape only">
        </div>
        `
    )

    updateDebuggerButtons();

    window.addEventListener('message', (ev: MessageEvent) => {
        let msg = ev.data;
        switch (msg.type || '') {
            case 'ready':
                let frameid = (msg as ks.rt.SimulatorReadyMessage).frameid;
                let frame = $('#' + frameid)[0] as HTMLIFrameElement;
                if (frame) startFrame(frame);
                break;
            case 'serial': break; //handled elsewhere
            case 'debugger': handleDebuggerMessage(msg); break;
            default:
                if (msg.type == 'radiopacket') {
                    // assign rssi noisy?
                    (msg as ks.rt.SimulatorRadioPacketMessage).rssi = 10;
                }
                postMessage(ev.data, ev.source);
                break;
        }
    }, false);

}


function resume(c: string) {
    isPaused = false
    config.highlightStatement(null)
    updateDebuggerButtons()
    postDebuggerMessage(c)
}

function updateDebuggerButtons(brk: ks.rt.DebuggerBreakpointMessage = null) {
    function btn(icon: string, name: string, click: () => void) {
        let b = $(`<button class="ui button green">${name}</button>`)
        if (icon) b.addClass("icon").append(`<i class="${icon} icon"></i>`)
        return b.click(click)
    }

    $('#debugger').empty()
        .append(btn("", lf("Debug"), () => { config.startDebug() }))

    if (isPaused)
        $('#debugger')
            .append(btn("right arrow", "", () => resume("stepover")))
            .append(btn("down arrow", "", () => resume("stepinto")))
            .append(btn("play", "", () => resume("resume")))

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

    let dbgView = $(`<div class="ui segment"></div>`)
    dbgView.append(vars(U.lf("globals"), brk.globals))
    brk.stackframes.forEach(sf => {
        let info = sf.funcInfo as ts.ks.FunctionLocationInfo
        dbgView.append(vars(info.functionName, sf.locals))
    })
    $('#debugger').append(dbgView)
}

function handleDebuggerMessage(msg: ks.rt.DebuggerMessage) {
    console.log("DBG-MSG", msg.subtype, msg)
    switch (msg.subtype) {
        case "breakpoint":
            let brk = msg as ks.rt.DebuggerBreakpointMessage
            isPaused = true
            updateDebuggerButtons(brk)
            let brkInfo = lastCompileResult.breakpoints[brk.breakpointId]
            config.highlightStatement(brkInfo)
            break;
    }
}

function postDebuggerMessage(subtype: string, data: any = {}) {
    let msg: ks.rt.DebuggerMessage = JSON.parse(JSON.stringify(data))
    msg.type = "debugger"
    msg.subtype = subtype
    postMessage(msg)
}

function postMessage(msg: ks.rt.SimulatorMessage, source?: Window) {
    // dispatch to all iframe besides self
    let frames = $('#simulators iframe');
    if (source && (msg.type === 'eventbus' || msg.type == 'radiopacket') && frames.length < 2) {
        let frame = createFrame()
        $('#simulators').append(frame);
        frames = $('#simulators iframe');
    }
    frames.each((index, el) => {
        let frame = el as HTMLIFrameElement
        if (source && frame.contentWindow == source) return;

        frame.contentWindow.postMessage(msg, "*");
    })
}

function createFrame(): HTMLIFrameElement {
    let frame = document.createElement('iframe') as HTMLIFrameElement;
    frame.id = ks.Util.guidGen()
    frame.className = 'simframe';
    frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
    let cdn = (window as any).simCdnRoot
    frame.src = cdn + 'simulator.html#' + frame.id;
    frame.frameBorder = "0";
    return frame;
}

function startFrame(frame: HTMLIFrameElement) {
    let msg = ks.U.clone(currentRuntime) as ks.rt.SimulatorRunMessage;
    let mc = '';
    let m = /player=([A-Za-z0-9]+)/i.exec(window.location.href); if (m) mc = m[1];
    msg.options = {
        theme: themes[nextFrameId++ % themes.length],
        player: mc
    };
    msg.id = `${msg.options.theme}-${ks.Util.guidGen()}`;
    frame.contentWindow.postMessage(msg, "*");
    frame.classList.remove("grayscale")
}

export function stop(unload_ = false) {
    postMessage({ type: 'stop' });
    if (unload_) unload();
    let simulators = $('#simulators');
    simulators.find('iframe').addClass("grayscale")
}

function unload() {
    $('#simulators').html('');
}

export function run(res: ts.ks.CompileResult) {
    let js = res.outfiles["microbit.js"]
    lastCompileResult = res

    // store information
    currentRuntime = {
        type: 'run',
        enums: res.enums,
        code: js
    }

    let simulators = $('#simulators');
    // drop extras frames
    simulators.find('iframe').slice(1).remove();
    let frame = simulators.find('iframe')[0] as HTMLIFrameElement;
    // lazy allocate iframe
    if (!frame) {
        frame = createFrame();
        simulators.append(frame);
        // delay started
    } else
        startFrame(frame);
}
