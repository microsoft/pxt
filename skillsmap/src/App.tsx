/// <reference path="./lib/skillMap.d.ts" />

import React from 'react';
import { connect } from 'react-redux';

import { dispatchAddSkillsMap, dispatchClearSkillsMaps, dispatchSetPageTitle, dispatchSetPageDescription, dispatchSetPageInfoUrl } from './actions/dispatch';
import { SkillsMapState } from './store/reducer';
import { HeaderBar } from './components/HeaderBar';
import { Banner } from './components/Banner';
import { SkillsCarousel } from './components/SkillsCarousel';

import { parseSkillsMap } from './lib/skillMapParser';
import { parseHash, getMarkdownAsync, MarkdownSource } from './lib/browserUtils';

import './App.css';
import { MakeCodeFrame } from './components/makecodeFrame';

interface AppProps {
    skillsMaps: { [key: string]: SkillsMap };
    activityOpen: boolean;
    dispatchAddSkillsMap: (map: SkillsMap) => void;
    dispatchClearSkillsMaps: () => void;
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
        this.fetchAndParseSkillsMaps(hash.cmd as MarkdownSource, hash.arg);

        e.stopPropagation();
        e.preventDefault();
    }

    protected fetchAndParseSkillsMaps(source: MarkdownSource, url: string) {
        getMarkdownAsync(source, url).then((md) => {
            if (md) {
                const { maps, metadata } = parseSkillsMap(md);
                if (maps?.length > 0) {
                    this.props.dispatchClearSkillsMaps();
                    maps.forEach(map => {
                        this.props.dispatchAddSkillsMap(map);
                    })
                }
                if (metadata) {
                    const { title, description, infoUrl } = metadata;
                    this.props.dispatchSetPageTitle(title);
                    if (description) this.props.dispatchSetPageDescription(description);
                    if (infoUrl) this.props.dispatchSetPageDescription(infoUrl);
                }
            }
        });
    }

    componentDidMount() {
        let hash = parseHash();
        this.fetchAndParseSkillsMaps(hash.cmd as MarkdownSource, hash.arg);
    }

    componentWillUnmount() {
        window.removeEventListener("hashchange", this.handleHashChange);
    }

    render() {
        const {skillsMaps, activityOpen } = this.props;
        const maps = Object.keys(skillsMaps).map((id: string) => skillsMaps[id]);
        return (<div className="app-container">
                <HeaderBar />
                { activityOpen ? <MakeCodeFrame /> : <div>
                    <Banner title="Game Maker Guide" icon="map" description="Level up your game making skills by completing the tutorials in this guide." />
                    <div className="skills-map-container">
                        { maps?.map((el, i) => {
                            return <SkillsCarousel map={el} key={i} />
                        })}
                    </div>
                </div>
                }
            </div>);
    }
}

function mapStateToProps(state: SkillsMapState, ownProps: any) {
    if (!state) return {};
    return {
        skillsMaps: state.maps,
        activityOpen: !!state.editorView
    };
}

const mapDispatchToProps = {
    dispatchAddSkillsMap,
    dispatchClearSkillsMaps,
    dispatchSetPageTitle,
    dispatchSetPageDescription,
    dispatchSetPageInfoUrl
};

const App = connect(mapStateToProps, mapDispatchToProps)(AppImpl);

export default App;