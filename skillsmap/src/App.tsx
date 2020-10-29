/// <reference path="./lib/skillMap.d.ts" />

import React from 'react';
import { connect } from 'react-redux';

import { dispatchAddSkillsMap } from './actions/dispatch';
import { SkillsCarousel } from './components/SkillsCarousel';

import { test } from './lib/skillMapParser';

import './App.css';

interface AppProps {
    dispatchAddSkillsMap: (map: SkillsMap) => void;
}

class AppImpl extends React.Component<AppProps> {
    protected skillsMaps: SkillsMap[];

    constructor(props: any) {
        super(props);
        this.skillsMaps = test();
        this.skillsMaps.forEach(map => props.dispatchAddSkillsMap(map));
    }

    render() {
        return (<div>
                <div className="skills-map-container">
                    {this.skillsMaps.map((el, i) => {
                        return <SkillsCarousel map={el} key={i} />
                    })}
                </div>
            </div>);
    }
}

function mapStateToProps(state: any, ownProps: any) {
    return {};
}

const mapDispatchToProps = {
    dispatchAddSkillsMap
};

const App = connect(mapStateToProps, mapDispatchToProps)(AppImpl);

export default App;