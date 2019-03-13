import * as React from "react";
import * as codecard from "./codecard"
import * as sui from "./sui"
import * as data from "./data"

type ISettingsProps = pxt.editor.ISettingsProps;

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
    "bg": { englishName: "Bulgarian", localizedName: "български" },
    "ca": { englishName: "Catalan", localizedName: "Català" },
    "cs": { englishName: "Czech", localizedName: "Čeština" },
    "da": { englishName: "Danish", localizedName: "Dansk" },
    "de": { englishName: "German", localizedName: "Deutsch" },
    "el": { englishName: "Greek", localizedName: "Ελληνικά" },
    "en": { englishName: "English", localizedName: "English" },
    "es-ES": { englishName: "Spanish (Spain)", localizedName: "Español (España)" },
    "es-MX": { englishName: "Spanish (Mexico)", localizedName: "Español (México)" },
    "fi": { englishName: "Finnish", localizedName: "Suomi" },
    "fr": { englishName: "French", localizedName: "Français" },
    "fr-CA": { englishName: "French (Canada)", localizedName: "Français (Canada)" },
    "he": { englishName: "Hebrew", localizedName: "עברית" },
    "hr": { englishName: "Croatian", localizedName: "Hrvatski" },
    "hu": { englishName: "Hungarian", localizedName: "Magyar" },
    "hy-AM": { englishName: "Armenian (Armenia)", localizedName: "Հայերէն (Հայաստան)" },
    "id": { englishName: "Indonesian", localizedName: "Bahasa Indonesia" },
    "is": { englishName: "Icelandic", localizedName: "Íslenska" },
    "it": { englishName: "Italian", localizedName: "Italiano" },
    "ja": { englishName: "Japanese", localizedName: "日本語" },
    "ko": { englishName: "Korean", localizedName: "한국어" },
    "lt": { englishName: "Lithuanian", localizedName: "Lietuvių" },
    "nl": { englishName: "Dutch", localizedName: "Nederlands" },
    "no": { englishName: "Norwegian", localizedName: "Norsk" },
    "pl": { englishName: "Polish", localizedName: "Polski" },
    "pt-BR": { englishName: "Portuguese (Brazil)", localizedName: "Português (Brasil)" },
    "pt-PT": { englishName: "Portuguese (Portugal)", localizedName: "Português (Portugal)" },
    "ro": { englishName: "Romanian", localizedName: "Română" },
    "ru": { englishName: "Russian", localizedName: "Русский" },
    "si-LK": { englishName: "Sinhala (Sri Lanka)", localizedName: "සිංහල (ශ්රී ලංකා)" },
    "sk": { englishName: "Slovak", localizedName: "Slovenčina" },
    "sl": { englishName: "Slovenian", localizedName: "Slovenski" },
    "sr": { englishName: "Serbian", localizedName: "Srpski" },
    "sv-SE": { englishName: "Swedish (Sweden)", localizedName: "Svenska (Sverige)" },
    "ta": { englishName: "Tamil", localizedName: "தமிழ்" },
    "tr": { englishName: "Turkish", localizedName: "Türkçe" },
    "uk": { englishName: "Ukrainian", localizedName: "Українська" },
    "vi": { englishName: "Vietnamese", localizedName: "Tiếng việt" },
    "zh-CN": { englishName: "Chinese (Simplified)", localizedName: "简体中文" },
    "zh-TW": { englishName: "Chinese (Traditional)", localizedName: "繁体中文" },
};
const pxtLangCookieId = "PXT_LANG";
const langCookieExpirationDays = 30;
const defaultLanguages = ["en"];

export let initialLang: string;

export function setInitialLang(lang: string) {
    initialLang = pxt.Util.normalizeLanguageCode(lang)[0];
}

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
        if (!allLanguages[langId]) {
            return;
        }

        setCookieLang(langId);

        if (langId !== initialLang) {
            pxt.tickEvent(`menu.lang.changelang.${langId}`);
            pxt.winrt.releaseAllDevicesAsync()
                .then(() => {
                    this.props.parent.reloadEditor();
                })
                .done();
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
                                name={allLanguages[langId].localizedName}
                                ariaLabel={allLanguages[langId].englishName}
                                description={allLanguages[langId].englishName}
                                onClick={this.changeLanguage}
                            />
                        )}
                    </div>
                </div>
                {targetTheme.crowdinProject ?
                    <p>
                        <br /><br />
                        <a href={`https://crowdin.com/project/${targetTheme.crowdinProject}`} target="_blank" rel="noopener noreferrer"
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