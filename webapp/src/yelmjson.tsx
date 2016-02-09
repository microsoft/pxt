import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as sui from "./sui";


var lf = Util.lf

export class Editor extends srceditor.Editor {
    config: yelm.PackageConfig = {} as any;

    prepare() {
        this.isReady = true
    }

    getId() {
        return "yelmjsonEditor"
    }

    display() {
        let c = this.config
        let update = (v: any) => {
            this.changeCallback()
        }
        return (
            <div className="ui segment form text container" style={{backgroundColor: "white"}}>
                <sui.Field>
                    <div className="ui toggle checkbox ">
                        <input type="checkbox" name="public" checked={c.public}
                            onChange={() => update(c.public = !c.public) } />
                        <label>{lf("Public package (library)") }</label>
                    </div>
                </sui.Field>
                <sui.Input label={lf("Name") } value={c.name} onChange={v => update(c.name = v) } />
                <sui.Input label={lf("Description") } lines={3} value={c.description} onChange={v => update(c.description = v) } />
            </div>
        )
    }

    getCurrentSource() {
        return JSON.stringify(this.config, null, 4) + "\n"
    }

    acceptsFile(file: pkg.File) {
        if (file.name != yelm.configName) return false

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
        this.setDiagnostics(file)
    }
}
