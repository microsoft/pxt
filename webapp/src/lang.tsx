import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"
import * as codecard from "./codecard"

type ISettingsProps = pxt.editor.ISettingsProps;

const lf = pxt.Util.lf;

interface LanguagesState {
    visible?: boolean;
    supportedLanguages: string[];
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

export class LanguagePicker extends React.Component<ISettingsProps, LanguagesState> {
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false,
            supportedLanguages: null
        }
    }

    fetchSupportedLanguagesAsync(): Promise<void> {
        if (this.state.supportedLanguages || !pxt.appTarget.appTheme.selectLanguage) {
            return Promise.resolve();
        }

        return pxt.targetConfigAsync()
            .then((targetCfg) => {
                if (targetCfg && targetCfg.languages) {
                    this.setState({ visible: this.state.visible, supportedLanguages: targetCfg.languages });
                }
            })
            .catch((e) => {
                pxt.log("Error fetching supported languages: " + e.message || e);
                pxt.tickEvent("menu.lang.langfetcherror");
            });
    }

    changeLanguage(langId: string) {
        if (!allLanguages[langId]) {
            return;
        }

        if (langId !== getCookieLang()) {
            pxt.tickEvent(`menu.lang.setcookielang.${langId}`);
            const expiration = new Date();
            expiration.setTime(expiration.getTime() + (langCookieExpirationDays * 24 * 60 * 60 * 1000));
            document.cookie = `${pxtLangCookieId}=${langId}; expires=${expiration.toUTCString()}`;
        }

        if (langId !== initialLang) {
            pxt.tickEvent(`menu.lang.changelang.${langId}`);
            window.location.hash = window.location.hash.replace(/(live)?lang=([a-z]{2,}(-[A-Z]+)?)/i, "");
            window.location.reload();
        } else {
            pxt.tickEvent(`menu.lang.samelang.${langId}`);
            this.hide();
        }
    }

    hide() {
        this.setState({ visible: false, supportedLanguages: this.state.supportedLanguages });
    }

    show() {
        this.setState({ visible: true, supportedLanguages: this.state.supportedLanguages });
    }

    render() {
        this.fetchSupportedLanguagesAsync();

        const targetTheme = pxt.appTarget.appTheme;
        const fetchedLangs = this.state.supportedLanguages;
        const languagesToShow = fetchedLangs && fetchedLangs.length ? fetchedLangs : defaultLanguages;
        const modalSize = languagesToShow.length > 4 ? "large" : "small";

        return (
            <sui.Modal open={this.state.visible} header={lf("Select Language") } size={modalSize}
                onClose={() => this.setState({ visible: false, supportedLanguages: this.state.supportedLanguages }) } dimmer={true}
                closeIcon={true}
                closeOnDimmerClick closeOnDocumentClick
                >
                <div className="group">
                    <div className="ui cards centered">
                        {languagesToShow.map(langId =>
                            <codecard.CodeCardView className="card-selected"
                                key={langId}
                                name={allLanguages[langId].localizedName}
                                description={allLanguages[langId].englishName}
                                onClick={() => this.changeLanguage(langId) }
                                />
                        ) }
                    </div>
                </div>
                <p><br/><br/>
                    <a href={`https://crowdin.com/project/${targetTheme.crowdinProject}`} target="_blank">{lf("Help us translate") }</a>
                </p>
            </sui.Modal>
        );
    }
}
