/// <reference path="./lib/skillMap.d.ts" />

import React from 'react';
import { connect } from 'react-redux';

import { dispatchAddSkillMap, dispatchClearSkillMaps, dispatchSetPageTitle, dispatchSetPageDescription, dispatchSetPageInfoUrl } from './actions/dispatch';
import { SkillMapState } from './store/reducer';
import { HeaderBar } from './components/HeaderBar';
import { Banner } from './components/Banner';
import { CompletionModal } from './components/CompletionModal';
import { SkillCarousel } from './components/SkillCarousel';

import { parseSkillMap } from './lib/skillMapParser';
import { parseHash, getMarkdownAsync, MarkdownSource } from './lib/browserUtils';

import './App.css';
import { MakeCodeFrame } from './components/makecodeFrame';

interface AppProps {
    skillMaps: { [key: string]: SkillMap };
    activityOpen: boolean;
    dispatchAddSkillMap: (map: SkillMap) => void;
    dispatchClearSkillMaps: () => void;
    dispatchSetPageTitle: (title: string) => void;
    dispatchSetPageDescription: (description: string) => void;
    dispatchSetPageInfoUrl: (infoUrl: string) => void;
}

class AppImpl extends React.Component<AppProps> {
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

    protected fetchAndParseSkillMaps(source: MarkdownSource, url: string) {
        getMarkdownAsync(source, url).then((md) => {
            if (md) {
                try {
                    const { maps, metadata } = parseSkillMap(md);
                    if (maps?.length > 0) {
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
        });
    }

    componentDidMount() {
        let hash = parseHash();
        this.fetchAndParseSkillMaps(hash.cmd as MarkdownSource, hash.arg);
    }

    componentWillUnmount() {
        window.removeEventListener("hashchange", this.handleHashChange);
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
                <CompletionModal />
            </div>);
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
    dispatchSetPageInfoUrl
};

const App = connect(mapStateToProps, mapDispatchToProps)(AppImpl);

export default App;