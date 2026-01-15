import * as React from "react";
import * as pkg from "./package";
import * as srceditor from "./srceditor"
import * as core from "./core";

import Util = pxt.Util;

import IProjectView = pxt.editor.IProjectView;
import { Checkbox } from "../../react-common/components/controls/Checkbox";
import { Button } from "../../react-common/components/controls/Button";
import { Input } from "../../react-common/components/controls/Input";
import { Textarea } from "../../react-common/components/controls/Textarea";

export class Editor extends srceditor.Editor {
    config: pxt.PackageConfig = {} as any;
    isSaving: boolean;
    changeMade: boolean = false;

    constructor(public parent: IProjectView) {
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

     async save(stayInEditor?: boolean) {
        this.isSaving = true;
        if (!this.config.name) {
            // Error saving no name
            core.errorNotification(lf("Please choose a project name. It can't be blank."));
            this.isSaving = false;
            return;
        }
        await this.saveConfigContentAsync();

        pkg.mainPkg.config.name = this.config.name;
        this.parent.setState({ projectName: this.config.name });
        this.parent.forceUpdate()
        Util.nextTick(this.changeCallback)
        this.isSaving = false;
        this.changeMade = true;
        // switch to previous coding experience
        if (!stayInEditor) this.parent.openPreviousEditor();
        core.resetFocus();
    }

    protected async saveConfigContentAsync() {
        const file = pkg.mainEditorPkg().lookupFile("this/" + pxt.CONFIG_NAME);
        await file.setContentAsync(pxt.Package.stringifyConfig(this.config));
        pkg.mainPkg.loadConfig();
    }

    async setFileName(v: string) {
        if (!v || !v.trim().length) {
            return;
        }

        const c = this.config
        c.name = v;

        await this.saveConfigContentAsync();

        this.parent.setState({ projectName: v });
    }

    private setProjectDescription = (v: string) => {
        const c = this.config;
        c.description = v;
        this.saveConfigContentAsync();
    }

    private optionaldepConfig() {
        // will contain all flatton configs
        let cfg: any = {};
        // look at all config coming dependencies
        pkg.mainPkg.sortedDeps()
            .filter(dep => dep.config && dep.config.yotta && dep.config.yotta.optionalConfig)
            .forEach(dep => Util.jsonMergeFrom(cfg, dep.config.yotta.optionalConfig));
        return cfg;
    }

    isUserConfigActive(uc: pxt.CompilationConfig) {
        let cfg = this.optionaldepConfig();
        if (this.config.yotta && this.config.yotta.config)
            Util.jsonMergeFrom(cfg, this.config.yotta.config);
        // flatten configs
        cfg = Util.jsonFlatten(cfg);

        const ucfg = Util.jsonFlatten(uc.config);
        return !Object.keys(ucfg).some(k => ucfg[k] === null ? !!cfg[k] : cfg[k] !== ucfg[k]);
    }

    applyUserConfig(uc: pxt.CompilationConfig) {
        const prjcfg = Util.jsonFlatten(this.config.yotta ? this.config.yotta.config : {});
        const usercfg = Util.jsonFlatten(uc.config);
        if (this.isUserConfigActive(uc)) {
            Object.keys(usercfg).forEach(k => {
                delete prjcfg[k];
            });
        } else {
            Object.keys(usercfg).forEach(k => prjcfg[k] = usercfg[k]);
        }
        // update cfg
        if (Object.keys(prjcfg).length) {
            if (!this.config.yotta) this.config.yotta = {};
            this.config.yotta.config = Util.jsonUnFlatten(prjcfg);
        } else {
            if (this.config.yotta) {
                delete this.config.yotta.config;
                if (!Object.keys(this.config.yotta).length)
                    delete this.config.yotta;
            }
        }
        // trigger update
        this.save(true);
    }

    private applyPropertyCheckbox = (option: pxt.PxtJsonOption, checked: boolean) => {
        if (option.type === "checkbox") {
            (this.config as any)[option.property] = checked;
            this.save(true);
        }
    }

    private showEditSettingsDialogAsync = async () => {
        pxt.tickEvent("pxtjson.editsettingsdialog", undefined, { interactiveConsent: true });

        const response = await core.confirmAsync({
            header: lf("Edit Settings as Text"),
            jsx: <>
                <p>
                    {lf("Editing your project settings as text can permanently damage your project!")}
                    <strong>{" " + lf("It is recommended that you download a copy of your project before continuing.")}</strong>
                </p>
                <p>
                    {lf("Are you sure you want to continue?")}
                </p>
            </>,
            agreeLbl: lf("Continue"),
            disagreeLbl: lf("Back to safety"),
            hideCancel: false,
            agreeClass: "red",
            disagreeClass: "green"
        });

        if (response) {
            this.editSettingsText();
        }
    }

    display(): JSX.Element {
        if (!this.isVisible) return undefined;

        const c = this.config;
        let userConfigs: pxt.CompilationConfig[] = [];
        pkg.allEditorPkgs().map(ep => ep.getKsPkg())
            .filter(dep => !!dep && dep.isLoaded && !!dep.config && !!dep.config.yotta && !!dep.config.yotta.userConfigs)
            .forEach(dep => userConfigs = userConfigs.concat(dep.config.yotta.userConfigs));

        const pxtJsonOptions = pxt.appTarget.appTheme?.pxtJsonOptions || [];

        return (
            <div className="ui content">
                <div className="ui small header">
                    <div className="content">
                        <Button
                            className="green"
                            title={lf("Go back")}
                            label={lf("Go back")}
                            leftIcon="fas fa-arrow-left"
                            onClick={this.goBack}
                        />
                    </div>
                </div>
                <div className="ui segment form text pxt-json-settings">
                    <Input
                        label={lf("Project Name")}
                        ariaLabel={lf("Type a name for your project")}
                        initialValue={c.name || ''}
                        onChange={this.setFileName}
                        autoComplete={false}
                        id="projectNameInputSettings"
                    />
                    {pxt.appTarget.appTheme.showProjectDescription &&
                        <Textarea
                            label={lf("Project Description")}
                            ariaLabel={lf("Type a description for your project")}
                            initialValue={c.description || ''}
                            onChange={this.setProjectDescription}
                            id="projectDescriptionTextareaSettings"
                            maxLength={pxt.MAX_DESCRIPTION_LENGTH}
                            showRemainingCharacterCount={500}
                            resize="vertical"
                        />
                    }
                    {userConfigs.map(uc =>
                        <UserConfigCheckbox
                            key={`userconfig-${uc.description}`}
                            uc={uc}
                            isUserConfigActive={this.isUserConfigActive}
                            applyUserConfig={this.applyUserConfig} />
                    )}
                    {pxtJsonOptions.map(option =>
                        <Checkbox
                            key={option.property}
                            id={option.property}
                            label={pxt.Util.rlf(`{id:setting}${option.label}`)}
                            isChecked={!!c?.[option.property as keyof pxt.PackageConfig]}
                            onChange={value => this.applyPropertyCheckbox(option, value)}
                            style="toggle"
                        />
                    )}
                    <div>
                        <Button
                            className="red"
                            label={lf("Edit settings as text")}
                            title={lf("Edit settings as text")}
                            onClick={this.showEditSettingsDialogAsync}
                        />
                    </div>
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
        return pxt.Package.stringifyConfig(this.config);
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
        if (this.changeMade && !this.parent.state?.home) {
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

const UserConfigCheckbox = (props: UserConfigCheckboxProps) => {
    const { uc, isUserConfigActive, applyUserConfig } = props;

    return (
        <Checkbox
            id={`userconfig-${uc.description}`}
            className="user-config-checkbox"
            ariaLabel={pxt.Util.rlf(uc.description)}
            label={pxt.Util.rlf(uc.description)}
            isChecked={isUserConfigActive(uc)}
            onChange={() => applyUserConfig(uc)}
            style="toggle"
        />
    )
};