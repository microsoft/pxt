/// <reference path="./lib/skillMap.d.ts" />

import React from 'react';
import { connect } from 'react-redux';

import store from "./store/store";
import * as authClient from "./lib/authClient";
import { getHeaderIdsForUnstartedMaps } from "./lib/skillMapUtils";

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
    setPageTitle, setPageSourceUrl, ParsedHash } from './lib/browserUtils';

import { MakeCodeFrame } from './components/makecodeFrame';
import { getLocalUserStateAsync, getUserStateAsync, saveUserStateAsync } from './lib/workspaceProvider';
import { Unsubscribe } from 'redux';

/* eslint-disable import/no-unassigned-import */
import './App.css';

// TODO: this file needs to read colors from the target
import './arcade.css';
import { UserProfile } from './components/UserProfile';
/* eslint-enable import/no-unassigned-import */
interface AppProps {
    skillMaps: { [key: string]: SkillMap };
    activityOpen: boolean;
    backgroundImageUrl: string;
    theme: SkillGraphTheme;
    signedIn: boolean;
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
    protected sendMessageAsync: ((message: any) => Promise<any>) | undefined;

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

        if (fetched && !user.completedTags[fetched]) {
            user.completedTags[fetched] = {};
        }

        this.applyQueryFlags(user, loadedMaps, fetched);
        this.loadedUser = user;
        this.props.dispatchSetUser(user);
    }

    protected async cloudSyncCheckAsync() {
        if (await authClient.loggedInAsync() && this.sendMessageAsync && this.loadedUser) {
            const state = store.getState();
            const localUser = await getLocalUserStateAsync();

            let headerIds = getHeaderIdsForUnstartedMaps(localUser, state.pageSourceUrl, state.user);

            // Tell the editor to transfer local skillmap projects to the cloud.
            const headerMap = (await this.sendMessageAsync({
                type: "pxteditor",
                action: "savelocalprojectstocloud",
                headerIds
            } as pxt.editor.EditorMessageSaveLocalProjectsToCloud)).resp.headerIdMap;

            if (headerMap) {
                headerIds = headerIds.map(h => headerMap[h] || h);

                // Patch all of the header ids in the user state and copy
                // over the local progress that doesn't exist in the signed in
                // user
                const urls = Object.keys(state.user.mapProgress);
                const newUser: UserState = {
                    ...state.user,
                    mapProgress: {}
                }

                for (const url of urls) {
                    newUser.mapProgress[url] = {
                        ...state.user.mapProgress[url],
                    };

                    if (!localUser.mapProgress[url]) continue;

                    const maps = Object.keys(localUser.mapProgress[url]);
                    for (const map of maps) {
                        newUser.mapProgress[url][map] = {
                            ...state.user.mapProgress[url][map]
                        };

                        // Only copy over state if the user hasn't started this map yet
                        if (Object.keys(newUser.mapProgress[url][map].activityState).length !== 0) {
                            continue;
                        }

                        const activityState: {[index: string]: ActivityState} = {};
                        newUser.mapProgress[url][map].activityState = activityState;

                        const signedInProgress = state.user.mapProgress[url][map].activityState;
                        const localProgress = localUser.mapProgress[url][map].activityState

                        for (const activity of Object.keys(signedInProgress)) {
                            const oldState = signedInProgress[activity];
                            activityState[activity] = {
                                ...oldState,
                                headerId: oldState.headerId ? (headerMap[oldState.headerId] || oldState.headerId) : oldState.headerId
                            };
                        }

                        for (const activity of Object.keys(localProgress)) {
                            const signedInActivity = signedInProgress[activity];
                            const localActivity = localProgress[activity];
                            if ((!signedInActivity || !signedInActivity.headerId) && localActivity.headerId) {
                                const base = signedInActivity || localActivity;
                                activityState[activity] = {
                                    ...base,
                                    headerId: localActivity.headerId ? (headerMap[localActivity.headerId] || localActivity.headerId) : localActivity.headerId
                                };
                            }
                        }
                    }
                }

                this.props.dispatchSetUser(newUser)
                await saveUserStateAsync(newUser);
            }

            // Tell the editor to send us the cloud status of our projects.
            await this.sendMessageAsync({
                type: "pxteditor",
                action: "requestprojectcloudstatus",
                headerIds
            } as pxt.editor.EditorMessageRequestProjectCloudStatus);
        }
    }

    protected onMakeCodeFrameLoaded = async (sendMessageAsync: (message: any) => Promise<any>) => {
        this.sendMessageAsync = sendMessageAsync;
        await this.cloudSyncCheckAsync();
    }

    async componentDidMount() {
        this.unsubscribeChangeListener = store.subscribe(this.onStoreChange);
        this.queryFlags = parseQuery();
        if (this.queryFlags["authcallback"]) {
            await authClient.loginCallbackAsync(this.queryFlags);
        }
        await authClient.authCheckAsync();
        await this.initLocalizationAsync();
        await this.parseHashAsync();
        await this.cloudSyncCheckAsync();
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
                    <div className={`skill-map-container ${activityOpen ? "hidden" : ""}`} style={{ backgroundColor: theme.backgroundColor }}>
                        { error
                            ? <div className="skill-map-error">{error}</div>
                            : <SkillGraphContainer maps={maps} backgroundImageUrl={backgroundImageUrl} />
                        }
                        { !error && <InfoPanel />}
                    </div>
                    <MakeCodeFrame onFrameLoaded={this.onMakeCodeFrameLoaded}/>
                <AppModal />
                <UserProfile />
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
        theme: state.theme,
        signedIn: state.auth.signedIn
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
