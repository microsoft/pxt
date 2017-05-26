import * as pkg from "./package";
import * as core from "./core";
import * as sui from "./sui";
import * as compiler from "./compiler"

export function makeAsync(): Promise<void> {
    return compiler.compileAsync({ native: true })
        .then(resp => {
            let p = pkg.mainEditorPkg();
            let code = p.files["main.ts"];
            let data: any = {
                name: p.header.name || lf("Untitled"),
                code: code ? code.content : `basic.showString("Hi!");`,
                board: JSON.stringify(pxt.appTarget.simulator.boardDefinition)
            };
            let parts = ts.pxtc.computeUsedParts(resp);
            if (parts.length) {
                data.parts = parts.join(" ");
                data.partdefs = JSON.stringify(pkg.mainPkg.computePartDefinitions(parts));
            }
            let fnArgs = resp.usedArguments;
            if (fnArgs)
                data.fnArgs = JSON.stringify(fnArgs);
            data.package = Util.values(pkg.mainPkg.deps).filter(p => p.id != "this").map(p => `${p.id}=${p._verspec}`).join('\n')
            let urlData = Object.keys(data).map(k => `${k}=${encodeURIComponent(data[k])}`).join('&');
            let url = `${pxt.webConfig.partsUrl}?${urlData}`

            return core.dialogAsync({
                hideCancel: true,
                header: lf("Make"),
                size: "large",
                htmlBody: `
        <div class="ui container">
            <div style="position:relative;height:0;padding-bottom:40%;overflow:hidden;">
                <iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="${url}" sandbox="allow-popups allow-forms allow-scripts allow-same-origin"
                    frameborder="0"></iframe>
            </div>
        </div>`,
                buttons: [{
                    label: lf("Open"),
                    url,
                    icon: "external"
                }]
            })
        }).then(r => {

        })
}