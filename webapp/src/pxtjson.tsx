import * as React from "react";
import * as pkg from "./package";
import * as srceditor from "./srceditor"
import * as sui from "./sui";
import * as core from "./core";
import * as data from "./data";

import Util = pxt.Util;

export class Editor extends srceditor.Editor {
    config: pxt.PackageConfig = {} as any;
    isSaving: boolean;
    changeMade: boolean = false;

    private nameInput: sui.Input;

    constructor(public parent: pxt.editor.IProjectView) {
        super(parent);

        this.editSettingsText = this.editSettingsText.bind(this);
        this.save = this.save.bind(this);
        this.setFileName = this.setFileName.bind(this);
        this.isUserConfigActive = this.isUserConfigActive.bind(this);
        this.applyUserConfig = this.applyUserConfig.bind(this);
        this.goBack = this.goBack.bind(this);
    }

    goBack() {
        pxt.tickEvent("pxtjson.backButton", undefined, { interactiveConsent: true })
        this.parent.openPreviousEditor()
    }

    prepare() {
        this.isReady = true
    }

    getId() {
        return "pxtJsonEditor"
    }

    hasEditorToolbar() {
        return false
    }

    save() {
        const c = this.config
        this.isSaving = true;
        if (!c.name) {
            // Error saving no name
            core.errorNotification(lf("Please choose a project name. It can't be blank."));
            this.isSaving = false;
            return;
        }
        const f = pkg.mainEditorPkg().lookupFile("this/" + pxt.CONFIG_NAME);
        f.setContentAsync(JSON.stringify(this.config, null, 4) + "\n").then(() => {
            pkg.mainPkg.config.name = c.name;
            this.parent.setState({ projectName: c.name });
            this.parent.forceUpdate()
            Util.nextTick(this.changeCallback)
            this.isSaving = false;
            this.changeMade = true;
            // switch to previous coding experience
            this.parent.openPreviousEditor();
            core.resetFocus();
        })
    }

    setFileName(v: string) {
        const c = this.config
        c.name = v;
        this.parent.forceUpdate();
    }

    private depConfig() {
        // will contain all flatton configs
        let cfg: any = {};
        // look at all config coming dependencies
        pkg.mainPkg.sortedDeps()
            .filter(dep => dep.config && dep.config.yotta && dep.config.yotta.optionalConfig)
            .forEach(dep => Util.jsonMergeFrom(cfg, dep.config.yotta.optionalConfig));
        return cfg;
    }

    isUserConfigActive(uc: pxt.CompilationConfig) {
        let cfg = this.depConfig();
        if (this.config.yotta && this.config.yotta.config)
            Util.jsonMergeFrom(cfg, this.config.yotta.config);
        // flatten configs
        cfg = Util.jsonFlatten(cfg);

        const ucfg = Util.jsonFlatten(uc.config);
        return !Object.keys(ucfg).some(k => ucfg[k] === null ? !!cfg[k] : cfg[k] !== ucfg[k]);
    }

    applyUserConfig(uc: pxt.CompilationConfig) {
        const depcfg = Util.jsonFlatten(this.depConfig());
        const cfg = Util.jsonFlatten(this.config.yotta ? this.config.yotta.config : {});
        const ucfg = Util.jsonFlatten(uc.config);
        if (this.isUserConfigActive(uc)) {
            Object.keys(ucfg).forEach(k => {
                if (depcfg[k]) cfg[k] = 0;
                else delete cfg[k]
            });
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
        this.save();
    }

    private handleNameInputRef = (c: sui.Input) => {
        this.nameInput = c;
    }

    display(): JSX.Element {
        if (!this.isVisible) return undefined;

        const c = this.config;
        let userConfigs: pxt.CompilationConfig[] = [];
        pkg.allEditorPkgs().map(ep => ep.getKsPkg())
            .filter(dep => !!dep && dep.isLoaded && !!dep.config && !!dep.config.yotta && !!dep.config.yotta.userConfigs)
            .forEach(dep => userConfigs = userConfigs.concat(dep.config.yotta.userConfigs));

        const gitJsonText = pkg.mainEditorPkg().getAllFiles()[pxt.github.GIT_JSON]
        const gitJson = JSON.parse(gitJsonText || "{}") as pxt.github.GitJson
        let gitLink = ""
        let gitDesc = ""
        let gitVer = "???"
        let gitVerLink = "#"

        if (gitJson.repo) {
            const parsed = pxt.github.parseRepoId(gitJson.repo)
            gitLink = "https://github.com/" + parsed.fullName
            gitDesc = parsed.fullName
            if (parsed.tag && parsed.tag != "master") {
                gitLink += "/tree/" + parsed.tag
                gitDesc += "#" + parsed.tag
            }
            if (gitJson.commit) {
                gitVer = gitJson.commit.tag || gitJson.commit.sha.slice(0, 8)
                gitVerLink = "https://github.com/" + parsed.fullName + "/commit/" + gitJson.commit.sha
            }
        }

        return (
            <div className="ui content">
                <h3 className="ui small header">
                    <div className="content">
                        <sui.Button title={lf("Go back")} tabIndex={0} onClick={this.goBack} onKeyDown={sui.fireClickOnEnter}>
                            <sui.Icon icon="arrow left" />
                            <span className="ui text landscape only">{lf("Go back")}</span>
                        </sui.Button>
                    </div>
                </h3>
                <div className="ui segment form text">
                    <sui.Input ref={this.handleNameInputRef} id={"fileNameInput"} label={lf("Name")} ariaLabel={lf("Type a name for your project")} value={c.name || ''} onChange={this.setFileName} autoComplete={false} />
                    {userConfigs.map(uc =>
                        <UserConfigCheckbox
                            key={`userconfig-${uc.description}`}
                            uc={uc}
                            isUserConfigActive={this.isUserConfigActive}
                            applyUserConfig={this.applyUserConfig} />
                    )}
                    {!gitLink ? undefined :
                        <p>
                            {lf("Source repository: ")}
                            <a target="_blank" href={gitLink} rel="noopener noreferrer">
                                {gitDesc}
                            </a>
                            {lf("; version ")}
                            <a target="_blank" href={gitVerLink} rel="noopener noreferrer">
                                {gitVer}
                            </a>
                        </p>}
                    <sui.Field>
                        <sui.Button text={lf("Save")} className={`green ${this.isSaving ? 'disabled' : ''}`} onClick={this.save} />
                        <sui.Button text={lf("Edit Settings As text")} onClick={this.editSettingsText} />
                    </sui.Field>
                </div>
            </div>
        )
    }

    isIncomplete() {
        return !this.changeMade;
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
        if (this.nameInput) this.nameInput.clearValue();
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

interface UserConfigCheckboxProps {
    uc: pxt.CompilationConfig;
    isUserConfigActive: (uc: pxt.CompilationConfig) => boolean;
    applyUserConfig: (uc: pxt.CompilationConfig) => void;
}

class UserConfigCheckbox extends data.Component<UserConfigCheckboxProps, {}> {
    constructor(props: UserConfigCheckboxProps) {
        super(props);
        this.state = {
        }
        this.isUserConfigActive = this.isUserConfigActive.bind(this);
        this.applyUserConfig = this.applyUserConfig.bind(this);
    }

    isUserConfigActive() {
        const { applyUserConfig, isUserConfigActive, uc } = this.props;
        return isUserConfigActive(uc);
    }

    applyUserConfig() {
        const { applyUserConfig, isUserConfigActive, uc } = this.props;
        applyUserConfig(uc);
    }

    renderCore() {
        const { uc } = this.props;
        const isChecked = this.isUserConfigActive();

        return <sui.Checkbox
            key={`userconfig-${uc.description}`}
            inputLabel={uc.description}
            checked={isChecked}
            onChange={this.applyUserConfig} />
    }
}