/// <reference path="./lib/skillMap.d.ts" />

import React from 'react';
import { connect } from 'react-redux';

import store from "./store/store";

import {
    dispatchAddSkillMap,
    dispatchClearSkillMaps,
    dispatchClearMetadata,
    dispatchSetPageTitle,
    dispatchSetPageDescription,
    dispatchSetPageInfoUrl,
    dispatchSetUser,
    dispatchSetPageSourceUrl,
    dispatchSetPageAlternateUrls,
    dispatchSetPageBackgroundImageUrl,
    dispatchSetPageBannerImageUrl,
    dispatchSetPageTheme,
} from './actions/dispatch';
import { PageSourceStatus, SkillMapState } from './store/reducer';
import { HeaderBar } from './components/HeaderBar';
import { AppModal } from './components/AppModal';
import { SkillGraphContainer } from './components/SkillGraphContainer';
import { InfoPanel } from './components/InfoPanel';

import { parseSkillMap } from './lib/skillMapParser';
import { parseHash, getMarkdownAsync, MarkdownSource, parseQuery,
    guidGen, setPageTitle, setPageSourceUrl, ParsedHash } from './lib/browserUtils';

import { MakeCodeFrame } from './components/makecodeFrame';
import { getUserStateAsync, saveUserStateAsync } from './lib/workspaceProvider';
import { Unsubscribe } from 'redux';

/* eslint-disable import/no-unassigned-import */
import './App.css';

// TODO: this file needs to read colors from the target
import './arcade.css';
/* eslint-enable import/no-unassigned-import */
interface AppProps {
    skillMaps: { [key: string]: SkillMap };
    activityOpen: boolean;
    backgroundImageUrl: string;
    theme: SkillGraphTheme;
    dispatchAddSkillMap: (map: SkillMap) => void;
    dispatchClearSkillMaps: () => void;
    dispatchClearMetadata: () => void;
    dispatchSetPageTitle: (title: string) => void;
    dispatchSetPageDescription: (description: string) => void;
    dispatchSetPageInfoUrl: (infoUrl: string) => void;
    dispatchSetPageBackgroundImageUrl: (backgroundImageUrl: string) => void;
    dispatchSetPageBannerImageUrl: (bannerImageUrl: string) => void;
    dispatchSetUser: (user: UserState) => void;
    dispatchSetPageSourceUrl: (url: string, status: PageSourceStatus) => void;
    dispatchSetPageAlternateUrls: (urls: string[]) => void;
    dispatchSetPageTheme: (theme: SkillGraphTheme) => void;
}

interface AppState {
    error?: string;
}

class AppImpl extends React.Component<AppProps, AppState> {
    protected queryFlags: {[index: string]: string} = {};
    protected unsubscribeChangeListener: Unsubscribe | undefined;
    protected loadedUser: UserState | undefined;

    constructor(props: any) {
        super(props);
        this.state = {};

        window.addEventListener("hashchange", this.handleHashChange);
    }

    protected handleHashChange = async (e: HashChangeEvent) => {
        await this.parseHashAsync();
        e.stopPropagation();
        e.preventDefault();
    }

    protected async parseHashAsync() {
        let config = await pxt.targetConfigAsync();
        let hash: ParsedHash;

        const possibleAlias = window.location.hash.replace("#", "");

        if (possibleAlias && config.skillMap?.pathAliases?.[possibleAlias]) {
            hash = parseHash(config.skillMap.pathAliases[possibleAlias]);
        }
        else {
            hash = parseHash(window.location.hash || config.skillMap?.defaultPath);
        }

        await this.fetchAndParseSkillMaps(hash.cmd as MarkdownSource, hash.arg);
    }

    protected handleError = (msg?: string) => {
        const errorMsg = msg || lf("Oops! Couldn't load content, please check the URL and markdown file.");
        console.error(errorMsg);
        this.setState({ error: errorMsg });
    }

    protected async initLocalizationAsync() {
        const theme = pxt.appTarget.appTheme;

        const href = window.location.href;
        let force = false;
        let useLang: string | undefined = undefined;
        if (/[&?]translate=1/.test(href) && !pxt.BrowserUtils.isIE()) {
            useLang = ts.pxtc.Util.TRANSLATION_LOCALE;
        } else {
            const mlang = /(live)?(force)?lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
            if (mlang && window.location.hash.indexOf(mlang[0]) >= 0) {
                pxt.BrowserUtils.changeHash(window.location.hash.replace(mlang[0], ""));
            }
            useLang = mlang ? mlang[3] : (pxt.BrowserUtils.getCookieLang() || theme.defaultLocale || (navigator as any).userLanguage || navigator.language);
            force = !!mlang && !!mlang[2];
        }

        // TODO: include the pxt webconfig so that we can get the commitcdnurl (and not always pass live=true)
        const baseUrl = "";
        const targetId = pxt.appTarget.id;
        const pxtBranch = pxt.appTarget.versions.pxtCrowdinBranch;
        const targetBranch = pxt.appTarget.versions.targetCrowdinBranch;
        if (!(pxt.BrowserUtils.isLocalHostDev() && (pxt.appTarget.appTheme.defaultLocale || "en") === useLang)
            && !pxt.BrowserUtils.isPxtElectron()) {
            pxt.Util.enableLiveLocalizationUpdates();
        }

        await updateLocalizationAsync({
            targetId: targetId,
            baseUrl: baseUrl,
            code: useLang!,
            pxtBranch: pxtBranch!,
            targetBranch: targetBranch!,
            force: force,
        });

        if (pxt.Util.isLocaleEnabled(useLang!)) {
            pxt.BrowserUtils.setCookieLang(useLang!);
        }
    }

    protected async fetchAndParseSkillMaps(source: MarkdownSource, url: string) {
        const result = await getMarkdownAsync(source, url);

        const md = result?.text;
        const fetched = result?.identifier;
        const status = result?.status;

        let loadedMaps: SkillMap[] | undefined;

        if (md && fetched && status) {
            try {
                if (status === "banned") {
                    this.handleError(lf("This GitHub repository has been banned."));
                } else {
                    setPageSourceUrl(fetched);
                    this.props.dispatchSetPageSourceUrl(fetched, status);
                    this.props.dispatchClearMetadata();
                }

                const { maps, metadata } = parseSkillMap(md);
                if (maps?.length > 0) {
                    loadedMaps = maps;
                    this.props.dispatchClearSkillMaps();
                    maps.forEach(map => {
                        this.props.dispatchAddSkillMap(map);
                    })
                }

                if (metadata) {
                    const { title, description, infoUrl, backgroundImageUrl,
                        bannerImageUrl, theme, alternateSources } = metadata;
                    setPageTitle(title);
                    this.props.dispatchSetPageTitle(title);
                    if (description) this.props.dispatchSetPageDescription(description);
                    if (infoUrl) this.props.dispatchSetPageInfoUrl(infoUrl);
                    if (backgroundImageUrl) this.props.dispatchSetPageBackgroundImageUrl(backgroundImageUrl);
                    if (bannerImageUrl) this.props.dispatchSetPageBannerImageUrl(bannerImageUrl);
                    if (alternateSources) this.props.dispatchSetPageAlternateUrls(alternateSources);
                    if (theme) this.props.dispatchSetPageTheme(theme);
                }

                this.setState({ error: undefined });
            } catch (err) {
                this.handleError(err);
            }
        } else {
            this.setState({ error: lf("No content loaded.") })
        }

        let user = await getUserStateAsync();

        if (!user) {
            user = {
                id: guidGen(),
                completedTags: {},
                mapProgress: {},
                version: pxt.skillmap.USER_VERSION
            };
        }

        if (fetched && !user.completedTags[fetched]) {
            user.completedTags[fetched] = {};
        }

        this.applyQueryFlags(user, loadedMaps, fetched);
        this.loadedUser = user;
        this.props.dispatchSetUser(user);
    }

    async componentDidMount() {
        this.unsubscribeChangeListener = store.subscribe(this.onStoreChange);
        this.queryFlags = parseQuery();
        await this.initLocalizationAsync();
        await this.parseHashAsync();
    }

    componentWillUnmount() {
        window.removeEventListener("hashchange", this.handleHashChange);
        if (this.unsubscribeChangeListener) {
            this.unsubscribeChangeListener();
        }
    }

    render() {
        const { skillMaps, activityOpen, backgroundImageUrl, theme } = this.props;
        const { error } = this.state;
        const maps = Object.keys(skillMaps).map((id: string) => skillMaps[id]);
        return (<div className={`app-container ${pxt.appTarget.id}`}>
                <HeaderBar />
                { activityOpen ? <MakeCodeFrame /> :
                    <div className="skill-map-container" style={{ backgroundColor: theme.backgroundColor }}>
                        { error
                            ? <div className="skill-map-error">{error}</div>
                            : <SkillGraphContainer maps={maps} backgroundImageUrl={backgroundImageUrl} />
                        }
                        { !error && <InfoPanel />}
                    </div>
                }
                <AppModal />
            </div>);
    }

    protected applyQueryFlags(user: UserState, maps?: SkillMap[], sourceUrl?: string) {
        const pageSource = sourceUrl || "default";
        if (this.queryFlags["debugNewUser"] === "true") {
            user.isDebug = true;
            user.mapProgress = { [pageSource]: {} };
            user.completedTags = {};
        }

        if (this.queryFlags["debugCompleted"] === "true") {
            user.isDebug = true;
            user.mapProgress = { [pageSource]: {} };

            if (maps) {
                for (const map of maps) {
                    user.mapProgress[pageSource][map.mapId] = {
                        completionState: "completed",
                        mapId: map.mapId,
                        activityState: {}
                    };

                    for (const key of Object.keys(map.activities)) {
                        const activity = map.activities[key];
                        if (!user.mapProgress[pageSource][map.mapId].activityState[activity.activityId]) {
                            user.mapProgress[pageSource][map.mapId].activityState[activity.activityId] = {
                                activityId: activity.activityId,
                                isCompleted: true
                            };
                        }
                        else {
                            user.mapProgress[pageSource][map.mapId].activityState[activity.activityId].isCompleted = true;
                        }

                        if (activity.kind === "activity" && activity.tags?.length && sourceUrl) {
                            for (const tag of activity.tags) {
                                if (!user.completedTags[sourceUrl][tag]) user.completedTags[sourceUrl][tag] = 0;
                                user.completedTags[sourceUrl][tag]++;
                            }
                        }
                    }
                }
            }
        }
    }

    protected onStoreChange = async () => {
        const { user } = store.getState();

        if (user !== this.loadedUser && (!this.loadedUser || user.id === this.loadedUser.id)) {
            await saveUserStateAsync(user);
            this.loadedUser = user;
        }
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};
    return {
        skillMaps: state.maps,
        activityOpen: !!state.editorView,
        backgroundImageUrl: state.backgroundImageUrl,
        theme: state.theme
    };
}
interface LocalizationUpdateOptions {
    targetId: string;
    baseUrl: string;
    code: string;
    pxtBranch: string;
    targetBranch: string;
    force?: boolean;
}

async function updateLocalizationAsync(opts: LocalizationUpdateOptions): Promise<void> {
    const {
        targetId,
        baseUrl,
        pxtBranch,
        targetBranch,
        force,
    } = opts;
    let { code } = opts;

    const translations = await pxt.Util.downloadTranslationsAsync(
        targetId,
        baseUrl,
        code,
        pxtBranch,
        targetBranch,
        pxt.Util.liveLocalizationEnabled(),
        ts.pxtc.Util.TranslationsKind.SkillMap
    );

    pxt.Util.setUserLanguage(code);
    if (translations) {
        pxt.Util.setLocalizedStrings(translations);
    }
}

const mapDispatchToProps = {
    dispatchAddSkillMap,
    dispatchClearSkillMaps,
    dispatchClearMetadata,
    dispatchSetPageTitle,
    dispatchSetPageDescription,
    dispatchSetPageInfoUrl,
    dispatchSetUser,
    dispatchSetPageSourceUrl,
    dispatchSetPageAlternateUrls,
    dispatchSetPageBackgroundImageUrl,
    dispatchSetPageBannerImageUrl,
    dispatchSetPageTheme
};

const App = connect(mapStateToProps, mapDispatchToProps)(AppImpl);

export default App;
