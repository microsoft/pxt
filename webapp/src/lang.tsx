import * as React from "react";
import * as codecard from "./codecard"
import * as sui from "./sui"
import * as data from "./data"
import * as core from "./core"

import ISettingsProps = pxt.editor.ISettingsProps;


interface LanguagesState {
    visible?: boolean;
}

const defaultLanguages = ["en"];

export let initialLang: string;

export function setInitialLang(lang: string) {
    initialLang = pxt.Util.normalizeLanguageCode(lang)[0];
}

export class LanguagePicker extends data.Component<ISettingsProps, LanguagesState> {
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false
        }

        this.hide = this.hide.bind(this);
        this.changeLanguage = this.changeLanguage.bind(this);
        this.translateEditor = this.translateEditor.bind(this);
    }

    languageList(): string[] {
        if (pxt.appTarget.appTheme.selectLanguage && pxt.appTarget.appTheme.availableLocales && pxt.appTarget.appTheme.availableLocales.length) {
            return pxt.appTarget.appTheme.availableLocales;
        }
        return defaultLanguages;
    }

    translateEditor() {
        pxt.tickEvent("translate.editor.incontext", undefined, { interactiveConsent: true })

        core.confirmAsync({
            header: lf("Translate the editor"),
            jsx: <div><p>
                {lf("This editor uses crowd-sourced translation! If you wish to help with translation, make sure to register as a translator.")}
            </p>
                <p>
                    {lf("'Translate' will reload the editor with in-context translations. Close the editor when done.")}
                </p></div>,
            helpUrl: "/translate",
            buttons: [{
                label: lf("Register"),
                icon: "xicon globe",
                className: lf("secondary"),
                title: lf("Register as a translator before starting the translation."),
                url: `https://crowdin.com/project/${pxt.appTarget.appTheme.crowdinProject}`
            }],
            agreeLbl: lf("Translate"),
            hasCloseIcon: true
        }).then(r => {
            if (r) {
                pxt.tickEvent("translate.editor.incontext.translate")
                const sep = window.location.href.indexOf("?") < 0 ? "?" : "&";
                window.location.href = window.location.pathname + (window.location.search || "") + sep + "translate=1" + (window.location.hash || "");
            }
        })
    }

    changeLanguage(langId: string) {
        if (!pxt.Util.allLanguages[langId]) {
            return;
        }

        if (langId !== initialLang) {
            pxt.tickEvent(`menu.lang.changelang`, { lang: langId });
            core.setLanguage(langId)
                .then(() => {
                    this.props.parent.reloadEditor();
                });
        } else {
            pxt.tickEvent(`menu.lang.samelang`, { lang: langId });
            this.hide();
        }
    }

    hide() {
        this.setState({ visible: false });
    }

    show() {
        this.setState({ visible: true });
    }

    renderCore() {
        if (!this.state.visible) return <div></div>;

        const targetTheme = pxt.appTarget.appTheme;
        const languageList = this.languageList();
        const modalSize = languageList.length > 4 ? "large" : "small";
        const translateTheEditor = !pxt.BrowserUtils.isIE()
            && !pxt.shell.isReadOnly()
            && !pxt.BrowserUtils.isPxtElectron()
            && pxt.appTarget.appTheme.crowdinProject;
        const classes = this.props.parent.createModalClasses();

        return (
            <sui.Modal isOpen={this.state.visible}
                className={classes}
                size={modalSize}
                onClose={this.hide}
                dimmer={true} header={lf("Select Language")}
                closeIcon={true}
                allowResetFocus={true}
                closeOnDimmerClick
                closeOnDocumentClick
                closeOnEscape
            >
                <div id="langmodal">
                    <div id="availablelocales" className="ui cards centered" role="list" aria-label={lf("List of available languages")}>
                        {languageList.map(langId => {
                            const lang = pxt.Util.allLanguages[langId];
                            return <LanguageCard
                                key={langId}
                                langId={langId}
                                name={lang.localizedName}
                                ariaLabel={lang.englishName}
                                description={lang.englishName}
                                onClick={this.changeLanguage}
                            />
                        }
                        )}
                    </div>
                    {targetTheme.crowdinProject ?
                        <div className="ui" id="langmodalfooter">
                            <sui.Link aria-label={lf("How do I add a new language?")} href="/translate" text={lf("How do I add a new language?")} target="_blank" />
                            {translateTheEditor && <sui.Button className="neutral" aria-label={lf("Translate the editor")} onClick={this.translateEditor} text={lf("Translate the editor")} />}
                        </div> : undefined}
                </div>
            </sui.Modal>
        );
    }
}

interface LanguageCardProps {
    langId: string;
    name: string;
    ariaLabel: string;
    description: string;
    onClick: (langId: string) => void;
}

class LanguageCard extends sui.StatelessUIElement<LanguageCardProps> {

    constructor(props: LanguageCardProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick() {
        this.props.onClick(this.props.langId);
    }

    renderCore() {
        const { name, ariaLabel, description } = this.props;
        return <codecard.CodeCardView className={`card-selected langoption`}
            name={name}
            ariaLabel={ariaLabel}
            role="listitem"
            description={description}
            onClick={this.handleClick}
        />
    }
}
