import * as React from "react";
import * as codecard from "./codecard"
import * as sui from "./sui"
import * as data from "./data"

type ISettingsProps = pxt.editor.ISettingsProps;

interface LanguagesState {
    visible?: boolean;
}

const defaultLanguages = ["en"];

export let initialLang: string;

export function setInitialLang(lang: string) {
    initialLang = pxt.Util.normalizeLanguageCode(lang)[0];
}

export function getCookieLang() {
    const cookiePropRegex = new RegExp(`${pxt.Util.escapeForRegex(pxt.Util.pxtLangCookieId)}=(.*?)(?:;|$)`)
    const cookieValue = cookiePropRegex.exec(document.cookie);
    return cookieValue && cookieValue[1] || null;
}

export function setCookieLang(langId: string) {
    if (!pxt.Util.allLanguages[langId]) {
        return;
    }

    if (langId !== getCookieLang()) {
        pxt.tickEvent(`menu.lang.setcookielang`, {lang : langId});
        const expiration = new Date();
        expiration.setTime(expiration.getTime() + (pxt.Util.langCookieExpirationDays * 24 * 60 * 60 * 1000));
        document.cookie = `${pxt.Util.pxtLangCookieId}=${langId}; expires=${expiration.toUTCString()}`;
    }
}

export class LanguagePicker extends data.Component<ISettingsProps, LanguagesState> {
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false
        }

        this.hide = this.hide.bind(this);
        this.changeLanguage = this.changeLanguage.bind(this);
    }

    languageList(): string[] {
        if (pxt.appTarget.appTheme.selectLanguage && pxt.appTarget.appTheme.availableLocales && pxt.appTarget.appTheme.availableLocales.length) {
            return pxt.appTarget.appTheme.availableLocales;
        }
        return defaultLanguages;
    }

    changeLanguage(langId: string) {
        if (!pxt.Util.allLanguages[langId]) {
            return;
        }

        setCookieLang(langId);

        if (langId !== initialLang) {
            pxt.tickEvent(`menu.lang.changelang`, {lang : langId});
            pxt.winrt.releaseAllDevicesAsync()
                .then(() => {
                    this.props.parent.reloadEditor();
                })
                .done();
        } else {
            pxt.tickEvent(`menu.lang.samelang`, {lang : langId});
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

        return (
            <sui.Modal isOpen={this.state.visible}
                size={modalSize}
                onClose={this.hide}
                dimmer={true} header={lf("Select Language")}
                closeIcon={true}
                allowResetFocus={true}
                closeOnDimmerClick
                closeOnDocumentClick
                closeOnEscape
            >
                <div className="group">
                    <div className="ui cards centered" role="listbox">
                        {languageList.map(langId =>
                            <LanguageCard
                                key={langId}
                                langId={langId}
                                name={pxt.Util.allLanguages[langId].localizedName}
                                ariaLabel={pxt.Util.allLanguages[langId].englishName}
                                description={pxt.Util.allLanguages[langId].englishName}
                                onClick={this.changeLanguage}
                            />
                        )}
                    </div>
                </div>
                {targetTheme.crowdinProject ?
                    <p>
                        <br /><br />
                        <a href="/translate" target="_blank" rel="noopener noreferrer"
                            aria-label={lf("Help us translate")}>{lf("Help us translate")}</a>
                    </p> : undefined}
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
        return <codecard.CodeCardView className={`card-selected`}
            name={name}
            ariaLabel={ariaLabel}
            role="link"
            description={description}
            onClick={this.handleClick}
        />
    }
}