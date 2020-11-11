/// <reference path="./lib/skillMap.d.ts" />

import React from 'react';
import { connect } from 'react-redux';

import store from "./store/store";

import { dispatchAddSkillMap, dispatchClearSkillMaps, dispatchSetPageTitle, dispatchSetPageDescription, dispatchSetPageInfoUrl, dispatchSetUser } from './actions/dispatch';
import { SkillMapState } from './store/reducer';
import { HeaderBar } from './components/HeaderBar';
import { Banner } from './components/Banner';
import { AppModal } from './components/AppModal';
import { SkillCarousel } from './components/SkillCarousel';

import { parseSkillMap } from './lib/skillMapParser';
import { parseHash, getMarkdownAsync, MarkdownSource, parseQuery, guidGen } from './lib/browserUtils';

import './App.css';
import { MakeCodeFrame } from './components/makecodeFrame';
import { getUserStateAsync, saveUserStateAsync } from './lib/workspaceProvider';
import { Unsubscribe } from 'redux';

interface AppProps {
    skillMaps: { [key: string]: SkillMap };
    activityOpen: boolean;
    dispatchAddSkillMap: (map: SkillMap) => void;
    dispatchClearSkillMaps: () => void;
    dispatchSetPageTitle: (title: string) => void;
    dispatchSetPageDescription: (description: string) => void;
    dispatchSetPageInfoUrl: (infoUrl: string) => void;
    dispatchSetUser: (user: UserState) => void;
}

class AppImpl extends React.Component<AppProps> {
    protected queryFlags: {[index: string]: string} = {};
    protected unsubscribeChangeListener: Unsubscribe | undefined;
    protected loadedUser: UserState | undefined;

    constructor(props: any) {
        super(props);

        window.addEventListener("hashchange", this.handleHashChange);
    }

    protected handleHashChange = (e: HashChangeEvent) => {
        let hash = parseHash();
        this.fetchAndParseSkillMaps(hash.cmd as MarkdownSource, hash.arg);

        e.stopPropagation();
        e.preventDefault();
    }

    protected async fetchAndParseSkillMaps(source: MarkdownSource, url: string) {
        const md = await getMarkdownAsync(source, url);

        let loadedMaps: SkillMap[] | undefined;

        if (md) {
            try {
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
                    this.props.dispatchSetPageTitle(title);
                    if (description) this.props.dispatchSetPageDescription(description);
                    if (infoUrl) this.props.dispatchSetPageDescription(infoUrl);
                }
            } catch {
                console.error("Error parsing markdown")
            }
        }

        let user = await getUserStateAsync();

        if (!user) {
            user = {
                id: guidGen(),
                completedTags: {},
                mapProgress: {}
            };
        }

        this.applyQueryFlags(user, loadedMaps);
        this.loadedUser = user;
        this.props.dispatchSetUser(user);
    }

    componentDidMount() {
        this.unsubscribeChangeListener = store.subscribe(this.onStoreChange);
        this.queryFlags = parseQuery();
        let hash = parseHash();
        this.fetchAndParseSkillMaps(hash.cmd as MarkdownSource, hash.arg);
    }

    componentWillUnmount() {
        window.removeEventListener("hashchange", this.handleHashChange);
        if (this.unsubscribeChangeListener) {
            this.unsubscribeChangeListener();
        }
    }

    render() {
        const {skillMaps, activityOpen } = this.props;
        const maps = Object.keys(skillMaps).map((id: string) => skillMaps[id]);
        return (<div className="app-container">
                <HeaderBar />
                { activityOpen ? <MakeCodeFrame /> : <div>
                    <Banner title="Game Maker Guide" icon="map" description="Level up your game making skills by completing the tutorials in this guide." />
                    <div className="skill-map-container">
                        { maps?.map((el, i) => {
                            return <SkillCarousel map={el} key={i} />
                        })}
                    </div>
                </div>
                }
                <AppModal />
            </div>);
    }

    protected applyQueryFlags(user: UserState, maps?: SkillMap[]) {
        if (this.queryFlags["debugNewUser"] === "true") {
            user.isDebug = true;
            user.mapProgress = {};
            user.completedTags = {};
        }

        if (this.queryFlags["debugCompleted"] === "true") {
            user.isDebug = true;

            if (maps) {
                for (const map of maps) {
                    user.mapProgress[map.mapId] = {
                        mapId: map.mapId,
                        activityState: {}
                    };

                    for (const key of Object.keys(map.activities)) {
                        const activity = map.activities[key];
                        if (!user.mapProgress[map.mapId].activityState[activity.activityId]) {
                            user.mapProgress[map.mapId].activityState[activity.activityId] = {
                                activityId: activity.activityId,
                                isCompleted: true
                            };
                        }
                        else {
                            user.mapProgress[map.mapId].activityState[activity.activityId].isCompleted = true;
                        }

                        if (activity.tags?.length) {
                            for (const tag of activity.tags) {
                                user.completedTags[tag]++;
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

const mapDispatchToProps = {
    dispatchAddSkillMap,
    dispatchClearSkillMaps,
    dispatchSetPageTitle,
    dispatchSetPageDescription,
    dispatchSetPageInfoUrl,
    dispatchSetUser
};

const App = connect(mapStateToProps, mapDispatchToProps)(AppImpl);

export default App;