import * as React from "react";
import * as pkg from "./package";
import * as srceditor from "./srceditor"
import * as sui from "./sui";
import * as codecard from "./codecard"

import Cloud = pxt.Cloud;
import Util = pxt.Util;

const lf = Util.lf

export class Editor extends srceditor.Editor {
    config: pxt.PackageConfig = {} as any;
    isSaving: boolean;
    changeMade: boolean = false;

    prepare() {
        this.isReady = true
    }

    getId() {
        return "pxtJsonEditor"
    }

    display() {
        const c = this.config
        const save = () => {
            this.isSaving = true;
            const f = pkg.mainEditorPkg().lookupFile("this/" + pxt.CONFIG_NAME);
            f.setContentAsync(JSON.stringify(this.config, null, 4) + "\n").then(() => {
                pkg.mainPkg.config.name = c.name;
                this.parent.setState({projectName: c.name});
                this.parent.forceUpdate()
                Util.nextTick(this.changeCallback)
                this.isSaving = false;
                this.changeMade = true;
                // switch to previous coding experience
                this.parent.openPreviousEditor();
            })
        }
        const setFileName = (v: string) => {
            c.name = v;
            this.parent.forceUpdate();
        }
        const deleteProject = () => {
            this.parent.removeProject();
        }
        const initCard = () => {
            if (!c.card) c.card = {}
        }
        const card = c.card || {};
        let userConfigs: pxt.CompilationConfig[] = [];
        pkg.allEditorPkgs().map(ep => ep.getKsPkg())
            .filter(dep => !!dep && dep.isLoaded && !!dep.config && !!dep.config.yotta && !!dep.config.yotta.userConfigs)
            .forEach(dep => userConfigs = userConfigs.concat(dep.config.yotta.userConfigs));

        const isUserConfigActive = (uc: pxt.CompilationConfig) => {
            const cfg = Util.jsonFlatten(this.config.yotta ? this.config.yotta.config : {});
            const ucfg = Util.jsonFlatten(uc.config);
            return !Object.keys(ucfg).some(k => ucfg[k] === null ? !!cfg[k] : cfg[k] !== ucfg[k]);
        }
        const applyUserConfig = (uc: pxt.CompilationConfig) => {
            const cfg = Util.jsonFlatten(this.config.yotta ? this.config.yotta.config : {});
            const ucfg = Util.jsonFlatten(uc.config);
            if (isUserConfigActive(uc)) {
                Object.keys(ucfg).forEach(k => delete cfg[k]);
            } else {
                Object.keys(ucfg).forEach(k => cfg[k] = ucfg[k]);
            }
            // update cfg
            if (Object.keys(cfg).length) {
                if (!this.config.yotta) this.config.yotta = {};
                Object.keys(cfg).filter(k => cfg[k] === null).forEach(k => delete cfg[k]);
                this.config.yotta.config = Util.jsonUnFlatten(cfg);
            } else {
                if (this.config.yotta) {
                    delete this.config.yotta.config;
                    if (!Object.keys(this.config.yotta).length)
                        delete this.config.yotta;
                }
            }
            // trigger update            
            save();
        }
        return (
            <div className="ui content">
                <div className="ui segment form text" style={{ backgroundColor: "white" }}>
                    <sui.Input id={"fileNameInput"} label={lf("Name")} ariaLabel={lf("Type a name for your project")} value={c.name} onChange={setFileName}/>
                    {userConfigs.map(uc =>
                        <sui.Checkbox
                            key={`userconfig-${uc.description}`}
                            inputLabel={uc.description}
                            checked={isUserConfigActive(uc) }
                            onChange={() => applyUserConfig(uc) } />
                    ) }
                    <sui.Field>
                        <sui.Button text={lf("Save")} class={`green ${this.isSaving ? 'disabled' : ''}`} onClick={() => save()} />
                        <sui.Button text={lf("Edit Settings As text") } onClick={() => this.editSettingsText() } />
                    </sui.Field>
                </div>
            </div>
        )
    }

    editSettingsText() {
        this.changeMade = false;
        this.parent.editText();
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

    loadFileAsync(file: pkg.File): Promise<void> {
        this.config = JSON.parse(file.content)
        this.setDiagnostics(file, this.snapshotState())
        this.changeMade = false;
        return Promise.resolve();
    }

    unloadFileAsync(): Promise<void> {
        if (this.changeMade) {
            return this.parent.reloadHeaderAsync();
        }
        return Promise.resolve();
    }
}
