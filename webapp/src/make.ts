import * as pkg from "./package";
import * as core from "./core";
import * as compiler from "./compiler"

const FRAME_ID = 'instructions'

function loadMakeFrameAsync(container: HTMLElement): Promise<HTMLIFrameElement> {
    return new Promise((resolve, reject) => {
        function waitForReady(ev: MessageEvent) {
            const data = ev.data as pxsim.SimulatorReadyMessage;
            if (data.type == "ready" && data.frameid == FRAME_ID) {
                window.removeEventListener('message', waitForReady);
                resolve(iframe);
            }
        }

        // register for ready message
        window.addEventListener('message', waitForReady)

        // load iframe in background
        // do not set an ID on this iframe
        const iframe = document.createElement("iframe");
        iframe.frameBorder = "0";
        iframe.setAttribute("allowfullscreen", "true");
        iframe.setAttribute("sandbox", "allow-popups allow-forms allow-scripts allow-same-origin allow-modals");
        iframe.setAttribute("style", "position:absolute;top:0;left:0;width:100%;height:100%;");
        iframe.src = pxt.webConfig.partsUrl + '#' + FRAME_ID;
        container.appendChild(iframe);
    })
}

function renderAsync(container: HTMLElement): Promise<HTMLIFrameElement> {
    let iframe: HTMLIFrameElement;
    return loadMakeFrameAsync(container)
        .then(frame => {
            iframe = frame;
            return compiler.compileAsync({ native: true });
        })
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
                    fnArgs,
                    configData,
                    print: true
                }
            }, "*")

            return iframe;
        });
}

export function makeAsync(): Promise<void> {
    let iframe: HTMLIFrameElement;
    return core.dialogAsync({
        header: lf("Make"),
        size: "large",
        hideCancel: true,
        htmlBody: `
        <div class="ui container">
            <div id="makecontainer" style="position:relative;height:0;padding-bottom:40%;overflow:hidden;">
            </div>
        </div>`, onLoaded: (_) => {
            renderAsync(_.querySelectorAll("#makecontainer")[0] as HTMLElement)
                .done(r => iframe = r);
        }
    }).then(r => {

    })
}