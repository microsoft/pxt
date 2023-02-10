import * as React from "react";
import { Link } from "../controls/Link";
import { Modal } from "../controls/Modal";
import { LanguageCard } from "./LanguageCard";


const defaultLanguages = ["en"];

interface LanguageSelectorProps {
    visible: boolean;
    onLanguageChanged: (newLang: string) => void;
    onClose: () => void;
}

export class LanguageSelector extends React.Component<LanguageSelectorProps> {
    constructor(props: LanguageSelectorProps) {
        super(props);
        this.changeLanguage = this.changeLanguage.bind(this);
    }

    languageList(): string[] {
        if (pxt.appTarget.appTheme.selectLanguage && pxt.appTarget.appTheme.availableLocales?.length) {
            return pxt.appTarget.appTheme.availableLocales;
        }
        return defaultLanguages;
    }

    changeLanguage(newLang: string) {
        if (!pxt.Util.allLanguages[newLang]) {
            return;
        }

        this.props.onLanguageChanged(newLang);
        this.props.onClose();
    }

    render() {
        if (!this.props.visible) {
            return null;
        }

        const targetTheme = pxt.appTarget.appTheme;
        const languageList = this.languageList();

        return (
            <Modal
                onClose={this.props.onClose}
                title={lf("Select Language")}
                className="language-selector-modal">
                <div
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
                                onClick={this.changeLanguage}/>
                        );
                    })}
                </div>
                {targetTheme.crowdinProject ? (
                    <Link
                        aria-label={lf("How do I add a new language?")}
                        href="/translate"
                        target="_blank">
                        {lf("How do I add a new language?")}
                    </Link>
                ) : undefined}
            </Modal>
        );
    }
}
