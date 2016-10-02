import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as sui from "./sui";
import * as codecard from "./codecard"

import Cloud = pxt.Cloud;
import Util = pxt.Util;

const lf = Util.lf

export class Editor extends srceditor.Editor {
    config: pxt.PackageConfig = {} as any;

    prepare() {
        this.isReady = true
    }

    getId() {
        return "pxtJsonEditor"
    }

    /*
                    <div className="three fields">
                        <sui.Input inputLabel={lf("Any") } type="number" value={(card.any || 0).toString() } onChange={v => {
                            initCard();
                            let vi = Math.max(0, parseInt(v) || 0)
                            update(c.card.any = vi)
                        } } />
                        <sui.Input inputLabel={lf("Hardware") } type="number" value={(card.hardware || 0).toString() } onChange={v => {
                            initCard();
                            let vi = Math.max(0, parseInt(v) || 0)
                            update(c.card.hardware = vi)
                        } } />
                        <sui.Input inputLabel={lf("Software") } type="number" value={(card.software || 0).toString() } onChange={v => {
                            initCard();
                            let vi = Math.max(0, parseInt(v) || 0)
                            update(c.card.software = vi)
                        } } />
                    </div>
*/

    display() {
        let c = this.config
        let update = (v: any) => {
            this.parent.forceUpdate()
            Util.nextTick(this.changeCallback)
        }
        let initCard = () => {
            if (!c.card) c.card = {}
        }
        let card = c.card || {};

        return (
            <div className="ui content">
                <div className="ui segment form text" style={{ backgroundColor: "white" }}>
                    {Cloud.isLoggedIn() ?
                        <sui.Field>
                            <div className="ui toggle checkbox ">
                                <input type="checkbox" name="public" checked={c.public}
                                    onChange={() => update(c.public = !c.public) } />
                                <label>{lf("Public package (library)") }</label>
                            </div>
                        </sui.Field> : ""}
                    <sui.Input label={lf("Description") } lines={3} value={c.description} onChange={v => update(c.description = v) } />
                    <sui.Field>
                        <sui.Button text={lf("Edit Settings As text") } onClick={() => this.parent.editText() } />
                        <sui.Button class="red" text={lf("Delete Project") } onClick={() => this.parent.removeProject() } />
                    </sui.Field>
                </div>
            </div>
        )
    }

    getCurrentSource() {
        return JSON.stringify(this.config, null, 4) + "\n"
    }

    acceptsFile(file: pkg.File) {
        if (file.name != pxt.CONFIG_NAME) return false

        if (file.isReadonly()) {
            // TODO add read-only support
            return false
        }

        try {
            let cfg = JSON.parse(file.content)
            // TODO validate?
            return true;
        } catch (e) {
            return false;
        }
    }

    loadFile(file: pkg.File) {
        this.config = JSON.parse(file.content)
        this.setDiagnostics(file, this.snapshotState())
    }

    menu() {
        return (<sui.Button class="button floating" text={lf("Back to Code") } icon={this.parent.state.header.editor == pxt.BLOCKS_PROJECT_NAME ? "puzzle" : "keyboard"} onClick={() => this.parent.setFile(pkg.mainEditorPkg().getMainFile()) } />)
    }
}
