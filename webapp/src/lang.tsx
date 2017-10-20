import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"
import * as codecard from "./codecard"
import * as data from "./data"

type ISettingsProps = pxt.editor.ISettingsProps;

const lf = pxt.Util.lf;

interface LanguagesState {
    visible?: boolean;
}

interface Language {
    englishName: string;
    localizedName: string;
}

const allLanguages: pxt.Map<Language> = {
    "af": { englishName: "Afrikaans", localizedName: "Afrikaans" },
    "ar": { englishName: "Arabic", localizedName: "العربية" },
    "ca": { englishName: "Catalan", localizedName: "Català" },
    "cs": { englishName: "Czech", localizedName: "Čeština" },
    "da": { englishName: "Danish", localizedName: "Dansk" },
    "de": { englishName: "German", localizedName: "Deutsch" },
    "el": { englishName: "Greek", localizedName: "Ελληνικά" },
    "en": { englishName: "English", localizedName: "English" },
    "es-ES": { englishName: "Spanish (Spain)", localizedName: "Español (España)" },
    "fi": { englishName: "Finnish", localizedName: "Suomi" },
    "fr": { englishName: "French", localizedName: "Français" },
    "he": { englishName: "Hebrew", localizedName: "עברית" },
    "hu": { englishName: "Hungarian", localizedName: "Magyar" },
    "it": { englishName: "Italian", localizedName: "Italiano" },
    "ja": { englishName: "Japanese", localizedName: "日本語" },
    "ko": { englishName: "Korean", localizedName: "한국어" },
    "nl": { englishName: "Dutch", localizedName: "Nederlands" },
    "no": { englishName: "Norwegian", localizedName: "Norsk" },
    "pl": { englishName: "Polish", localizedName: "Polski" },
    "pt-BR": { englishName: "Portuguese (Brazil)", localizedName: "Português (Brasil)" },
    "pt-PT": { englishName: "Portuguese (Portugal)", localizedName: "Português (Portugal)" },
    "ro": { englishName: "Romanian", localizedName: "Română" },
    "ru": { englishName: "Russian", localizedName: "Русский" },
    "si-LK": { englishName: "Sinhala (Sri Lanka)", localizedName: "සිංහල (ශ්රී ලංකා)" },
    "sr": { englishName: "Serbian", localizedName: "Srpski" },
    "sv-SE": { englishName: "Swedish (Sweden)", localizedName: "Svenska (Sverige)" },
    "tr": { englishName: "Turkish", localizedName: "Türkçe" },
    "uk": { englishName: "Ukrainian", localizedName: "Українська" },
    "vi": { englishName: "Vietnamese", localizedName: "Tiếng việt" },
    "zh-CN": { englishName: "Chinese (Simplified, China)", localizedName: "简体中文 (中国)" },
    "zh-TW": { englishName: "Chinese (Traditional, Taiwan)", localizedName: "中文 (台湾)" },
};
const pxtLangCookieId = "PXT_LANG";
const langCookieExpirationDays = 30;
const defaultLanguages = ["en"];

export let initialLang: string;

export function getCookieLang() {
    const cookiePropRegex = new RegExp(`${pxt.Util.escapeForRegex(pxtLangCookieId)}=(.*?)(?:;|$)`)
    const cookieValue = cookiePropRegex.exec(document.cookie);
    return cookieValue && cookieValue[1] || null;
}

export function setCookieLang(langId: string) {
    if (!allLanguages[langId]) {
        return;
    }

    if (langId !== getCookieLang()) {
        pxt.tickEvent(`menu.lang.setcookielang.${langId}`);
        const expiration = new Date();
        expiration.setTime(expiration.getTime() + (langCookieExpirationDays * 24 * 60 * 60 * 1000));
        document.cookie = `${pxtLangCookieId}=${langId}; expires=${expiration.toUTCString()}`;
    }
}

export class LanguagePicker extends data.Component<ISettingsProps, LanguagesState> {
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false
        }
    }

    fetchLanguages(): string[] {
        if (!pxt.appTarget.appTheme.selectLanguage)
            return undefined;

        const targetConfig = this.getData("target-config:") as pxt.TargetConfig;
        return targetConfig ? targetConfig.languages : undefined;
    }

    changeLanguage(langId: string) {
        if (!allLanguages[langId]) {
            return;
        }

        setCookieLang(langId);

        if (langId !== initialLang) {
            pxt.tickEvent(`menu.lang.changelang.${langId}`);
            location.hash = "#reload";
            location.reload();
        } else {
            pxt.tickEvent(`menu.lang.samelang.${langId}`);
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
        const fetchedLangs = this.fetchLanguages();
        const languagesToShow = fetchedLangs && fetchedLangs.length ? fetchedLangs : defaultLanguages;
        const modalSize = languagesToShow.length > 4 ? "large" : "small";

        return (
            <sui.Modal open={this.state.visible}
                header={lf("Select Language") }
                size={modalSize}
                onClose={() => this.hide() }
                dimmer={true}
                closeIcon={true}
                allowResetFocus={true}
                closeOnDimmerClick
                closeOnDocumentClick
                closeOnEscape
                >
                {!fetchedLangs ?
                    <div className="ui message info">{lf("loading...") }</div> : undefined}
                {fetchedLangs ? <div className="group">
                    <div className="ui cards centered" role="listbox">
                        {languagesToShow.map(langId =>
                            <codecard.CodeCardView className={`card-selected focused`}
                                key={langId}
                                name={allLanguages[langId].localizedName}
                                ariaLabel={allLanguages[langId].englishName}
                                role="option"
                                description={allLanguages[langId].englishName}
                                onClick={() => this.changeLanguage(langId) }
                                />
                        ) }
                    </div></div> : undefined }
                <p><br/><br/>
                    <a href={`https://crowdin.com/project/${targetTheme.crowdinProject}`} target="_blank" aria-label={lf("Help us translate")}>{lf("Help us translate") }</a>
                </p>
            </sui.Modal>
        );
    }
}
