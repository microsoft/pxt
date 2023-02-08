import * as React from "react";
import { Link } from "../controls/Link";
import { Modal } from "../controls/Modal";
import { LanguageCard } from "./LanguageCard";

// TODO thsparks : reduce duplication with lang.tsx. 

const defaultLanguages = ["en"];
let initialLang: string;

interface LanguageSelectorProps {
    visible: boolean;
    activityOpen: boolean;
    onClose: () => void;
}

export class LanguageSelector extends React.Component<LanguageSelectorProps> {
    constructor(props: LanguageSelectorProps) {
        super(props);
        this.changeLanguage = this.changeLanguage.bind(this);
    }

    setInitialLang(lang: string) {
        initialLang = pxt.Util.normalizeLanguageCode(lang)[0];
    }

    languageList(): string[] {
        if (pxt.appTarget.appTheme.selectLanguage && pxt.appTarget.appTheme.availableLocales && pxt.appTarget.appTheme.availableLocales.length) {
            return pxt.appTarget.appTheme.availableLocales;
        }
        return defaultLanguages;
    }

    // TODO thsparks - reduce duplication from webapp\src\app.tsx reloadEditor? That method also has a lot more safety in it...
    // TODO thsparks - Also this takes the user out of the workspace if they're in it, which we probably don't want. How to avoid?
    reloadEditor() {
        try {
            if (!this.props.activityOpen) {
                location.hash = "#reload"
            }
            else {
                location.hash = "#editor"
            }
            location.reload();
        } catch (e) {
            pxt.reportException(e);
            
        }
    }

    changeLanguage(langId: string) {
        if (!pxt.Util.allLanguages[langId]) {
            return;
        }

        if (langId !== initialLang) {
            pxt.tickEvent(`menu.lang.changelang`, { lang: langId });

            pxt.BrowserUtils.setCookieLang(langId);
            this.reloadEditor();
            // TODO thsparks : set user preference and reload editor? (see this method in lang.tsx)
        } else {
            pxt.tickEvent(`menu.lang.samelang`, { lang: langId });
            this.props.onClose();
        }
    }

    render() {
        if(!this.props.visible) {
            return null;
        }
        
        const targetTheme = pxt.appTarget.appTheme;
        const languageList = this.languageList();
        // TODO thsparks : Remove or figure out : const modalSize = languageList.length > 4 ? "large" : "small";
        const translateTheEditor = !pxt.BrowserUtils.isIE()
            && !pxt.shell.isReadOnly()
            && !pxt.BrowserUtils.isPxtElectron()
            && pxt.appTarget.appTheme.crowdinProject;

        return (
            <Modal
                onClose={this.props.onClose}
                title={lf("Select Language")}
                className="language-selector-modal"
                // TODO thsparks : Close if not needed
                // allowResetFocus={true}
                // closeOnDimmerClick
                // closeOnDocumentClick
                // closeOnEscape
            >
                <div id="langmodal">
                    <div
                        id="availablelocales"
                        className="ui cards centered language-selector"
                        role="list"
                        aria-label={lf("List of available languages")}>
                        {languageList.map((langId) => {
                            const lang = pxt.Util.allLanguages[langId];
                            return (
                                <LanguageCard
                                    key={langId}
                                    langId={langId}
                                    name={lang.localizedName}
                                    ariaLabel={lang.englishName}
                                    description={lang.englishName}
                                    onClick={this.changeLanguage}
                                />
                            );
                        })}
                    </div>
                    {targetTheme.crowdinProject ? (
                        <div className="ui" id="langmodalfooter">
                            <Link aria-label={lf("How do I add a new language?")} href="/translate" target="_blank">
                                {lf("How do I add a new language?")}
                            </Link>
                        </div>
                    ) : undefined}
                </div>
            </Modal>
        );
    }
}
