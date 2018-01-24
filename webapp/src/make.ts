import * as pkg from "./package";
import * as core from "./core";
import * as sui from "./sui";
import * as compiler from "./compiler"

const FRAME_ID = 'instructions'
let iframe: HTMLIFrameElement;


function loadMakeFrameAsync(): Promise<void> {
    if (iframe) return Promise.resolve();

    return new Promise((resolve, reject) => {
        function waitForReady(ev: MessageEvent) {
            const data = ev.data as pxsim.SimulatorReadyMessage;
            if (data.type == "ready" && data.frameid == FRAME_ID) {
                window.removeEventListener('message', waitForReady);
                resolve();
            }
        }

        // register for ready message
        window.addEventListener('message', waitForReady)

        // load iframe in background
        iframe = document.createElement("iframe");
        iframe.frameBorder = "0";
        iframe.setAttribute("sandbox", "allow-popups allow-forms allow-scripts allow-same-origin");
        iframe.setAttribute("style", "position:absolute;top:0;left:0;width:1px;height:1px;");
        iframe.src = pxt.webConfig.partsUrl + '#' + FRAME_ID;
        document.body.appendChild(iframe);
    })
}

export function makeAsync(): Promise<void> {

    return loadMakeFrameAsync()
        .then(() => compiler.compileAsync({ native: true }))
        .then(resp => {
            const p = pkg.mainEditorPkg();
            const name = p.header.name || lf("Untitled");
            const boardDef = pxt.appTarget.simulator.boardDefinition;
            const parts = ts.pxtc.computeUsedParts(resp).sort();
            const partDefinitions = pkg.mainPkg.computePartDefinitions(parts);
            const fnArgs = resp.usedArguments;
            let cfg: pxsim.Map<number> = {}
            let cfgKey: pxsim.Map<number> = {}
            for (let ce of resp.configData || []) {
                cfg[ce.key + ""] = ce.value
                cfgKey[ce.name] = ce.key
            }
            const configData = <pxsim.ConfigData>{ cfg, cfgKey };

            iframe.contentWindow.postMessage(<pxsim.SimulatorInstructionsMessage>{
                type: "instructions",
                options: {
                    name,
                    boardDef,
                    parts,
                    partDefinitions,
                    configData
                }
            }, "*")

            return core.dialogAsync({
                hideCancel: true,
                header: lf("Make"),
                size: "large",
                htmlBody: `
        <div class="ui container">
            <div id="makecontainer" style="position:relative;height:0;padding-bottom:40%;overflow:hidden;">
            </div>
        </div>`, onLoaded: (_) => {
                    _.find("#makecontainer").append(iframe);
                },
                buttons: [{
                    label: lf("Print"),
                    onclick: () => {
                        if (iframe && iframe.contentWindow) {
                            iframe.contentWindow.focus();
                            iframe.contentWindow.print();
                        }
                    },
                    icon: "print"
                }]
            })
        }).then(r => {

        })
}