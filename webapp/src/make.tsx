import * as React from "react";
import * as ReactDOM from "react-dom";
import * as pkg from "./package";
import * as core from "./core";
import * as compiler from "./compiler"

const FRAME_ID = 'instructions'

function loadMakeFrameAsync(iframe: HTMLIFrameElement): Promise<void> {
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
        iframe.src = pxt.webConfig.partsUrl + '#' + FRAME_ID;
    })
}

function renderAsync(iframe: HTMLIFrameElement): Promise<HTMLIFrameElement> {
    return loadMakeFrameAsync(iframe)
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
            const configData: pxsim.ConfigData = { cfg, cfgKey };

            iframe.contentWindow.postMessage({
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
            } as pxsim.SimulatorInstructionsMessage, "*")

            return iframe;
        });
}

export function makeAsync(): Promise<void> {
    return core.dialogAsync({
        header: lf("Make"),
        size: "large",
        hideCancel: true,
        hasCloseIcon: true,
        jsx:
            /* tslint:disable:react-iframe-missing-sandbox */
            <div className="ui container">
                <div id="makecontainer" style={{ 'position': 'relative', 'height': 0, 'paddingBottom': '40%', 'overflow': 'hidden' }}>
                    <iframe id="makeiframe" frameBorder="0"
                        sandbox="allow-popups allow-forms allow-scripts allow-same-origin allow-modals"
                        style={{ 'position': 'absolute', 'top': 0, 'left': 0, 'width': '100%', 'height': '100%' }}
                        />
                </div>
            </div>
        /* tslint:enable:react-iframe-missing-sandbox */
        , onLoaded: (_) => {
            renderAsync(_.querySelectorAll("#makeiframe")[0] as HTMLIFrameElement)
                .done();
        }
    }).then(r => {
    })
}