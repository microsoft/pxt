/// <reference path="./lib/skillMap.d.ts" />

import React from 'react';
import { connect } from 'react-redux';

import * as Promise from "bluebird";
import store from "./store/store";

import {
    dispatchAddSkillMap,
    dispatchClearSkillMaps,
    dispatchSetPageTitle,
    dispatchSetPageDescription,
    dispatchSetPageInfoUrl,
    dispatchSetUser,
    dispatchSetPageSourceUrl
} from './actions/dispatch';
import { PageSourceStatus, SkillMapState } from './store/reducer';
import { HeaderBar } from './components/HeaderBar';
import { Banner } from './components/Banner';
import { AppModal } from './components/AppModal';
import { SkillCarousel } from './components/SkillCarousel';

import { parseSkillMap } from './lib/skillMapParser';
import { parseHash, getMarkdownAsync, MarkdownSource, parseQuery,
    guidGen, setPageTitle, setPageSourceUrl } from './lib/browserUtils';

import { MakeCodeFrame } from './components/makecodeFrame';
import { getUserStateAsync, saveUserStateAsync } from './lib/workspaceProvider';
import { Unsubscribe } from 'redux';

/* tslint:disable:no-import-side-effect */
import './App.css';

// TODO: this file needs to read colors from the target
import './arcade.css';
/* tslint:enable:no-import-side-effect */

(window as any).Promise = Promise;

interface AppProps {
    skillMaps: { [key: string]: SkillMap };
    activityOpen: boolean;
    dispatchAddSkillMap: (map: SkillMap) => void;
    dispatchClearSkillMaps: () => void;
    dispatchSetPageTitle: (title: string) => void;
    dispatchSetPageDescription: (description: string) => void;
    dispatchSetPageInfoUrl: (infoUrl: string) => void;
    dispatchSetUser: (user: UserState) => void;
    dispatchSetPageSourceUrl: (url: string, status: PageSourceStatus) => void;
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
        let config = await pxt.targetConfigAsync();
        let hash = parseHash(window.location.hash || config.skillMap?.defaultPath);
        this.fetchAndParseSkillMaps(hash.cmd as MarkdownSource, hash.arg);

        e.stopPropagation();
        e.preventDefault();
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
            console.log(`translation mode`);
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

        await updateLocalizationAsync(
            targetId,
            baseUrl,
            useLang!,
            pxtBranch!,
            targetBranch!,
            true,
            force
        );

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
                    const { title, description, infoUrl } = metadata;
                    setPageTitle(title);
                    this.props.dispatchSetPageTitle(title);
                    if (description) this.props.dispatchSetPageDescription(description);
                    if (infoUrl) this.props.dispatchSetPageInfoUrl(infoUrl);
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

        this.applyQueryFlags(user, loadedMaps);
        this.loadedUser = user;
        this.props.dispatchSetUser(user);
    }

    async componentDidMount() {
        this.unsubscribeChangeListener = store.subscribe(this.onStoreChange);
        this.queryFlags = parseQuery();
        let config = await pxt.targetConfigAsync();
        let hash = parseHash(window.location.hash || config.skillMap?.defaultPath);
        await this.initLocalizationAsync();
        this.fetchAndParseSkillMaps(hash.cmd as MarkdownSource, hash.arg);
    }

    componentWillUnmount() {
        window.removeEventListener("hashchange", this.handleHashChange);
        if (this.unsubscribeChangeListener) {
            this.unsubscribeChangeListener();
        }
    }

    render() {
        const { skillMaps, activityOpen } = this.props;
        const { error } = this.state;
        const maps = Object.keys(skillMaps).map((id: string) => skillMaps[id]);
        return (<div className={`app-container ${pxt.appTarget.id}`}>
                <HeaderBar />
                { activityOpen ? <MakeCodeFrame /> : <div>
                    <Banner icon="map" />
                    <div className="skill-map-container">
                        { error
                            ? <div className="skill-map-error">{error}</div>
                            : maps?.map((el, i) => {
                                return <SkillCarousel map={el} key={i} />
                            })}
                    </div>
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

                        if (activity.tags?.length && sourceUrl) {
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
        activityOpen: !!state.editorView
    };
}

async function updateLocalizationAsync(targetId: string, baseUrl: string, code: string, pxtBranch: string, targetBranch: string, live?: boolean, force?: boolean) {
    code = pxt.Util.normalizeLanguageCode(code)[0];
    if (code === "en-US")
        code = "en"; // special case for built-in language
    if (code === pxt.Util.userLanguage() || (!pxt.Util.isLocaleEnabled(code) && !force)) {
        return;
    }

    const translations = await pxt.Util.downloadTranslationsAsync(
        targetId,
        baseUrl,
        code,
        pxtBranch,
        targetBranch,
        !!live,
        ts.pxtc.Util.TranslationsKind.SkillMap
    );

    pxt.Util.setUserLanguage(code);
    if (translations) {
        pxt.Util.setLocalizedStrings(translations);
        if (live) {
            pxt.Util.localizeLive = true;
        }
    }
}

const mapDispatchToProps = {
    dispatchAddSkillMap,
    dispatchClearSkillMaps,
    dispatchSetPageTitle,
    dispatchSetPageDescription,
    dispatchSetPageInfoUrl,
    dispatchSetUser,
    dispatchSetPageSourceUrl
};

const App = connect(mapStateToProps, mapDispatchToProps)(AppImpl);

export default App;