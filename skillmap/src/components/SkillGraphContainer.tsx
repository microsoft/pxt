import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { SkillGraph } from "./SkillGraph";
import { SvgGraph, getGraph, PADDING, UNIT, MIN_HEIGHT, MIN_WIDTH } from '../lib/skillGraphUtils';

/* eslint-disable import/no-unassigned-import, import/no-internal-modules */
import '../styles/skillgraph.css'
import { MenuBar } from "react-common/controls/MenuBar";
/* eslint-enable import/no-unassigned-import, import/no-internal-modules */

interface SkillGraphContainerProps {
    maps: SkillMap[];
    graphs: SvgGraph[];
    backgroundImageUrl: string;
    backgroundColor: string;
    graphSize: {
        width: number;
        height: number;
    };
}

interface SkillGraphContainerState {
    backgroundSize: {
        width: number;
        height: number;
    };
    backgroundColor: string;
}

const THRESHOLD = 0.05;

export class SkillGraphContainerImpl extends React.Component<SkillGraphContainerProps, SkillGraphContainerState> {
    constructor(props: SkillGraphContainerProps) {
        super(props);

        this.state = { backgroundSize: { width: 0, height: 0 }, backgroundColor: this.props.backgroundColor };
    }

    protected onImageLoad = (evt: any) => {
        this.setState({
            backgroundSize: {
                width: evt.target.naturalWidth,
                height: evt.target.naturalHeight
            }
        })
    }

    render() {
        const { maps, graphs, graphSize, backgroundImageUrl, backgroundColor } = this.props;
        const { backgroundSize } = this.state;
        const darkBackgroundColors = ['#5c406c', '#000000'];
        let altTextColor: string = 'black';
        let backgroundAltText: string = `Background image for ${maps[0]?.displayName}`; 
        let translateY = 0;

        const padding = PADDING * UNIT;
        const graphAspectRatio = graphSize.width / graphSize.height;
        const backgroundAspectRatio = backgroundSize.width / backgroundSize.height;
        const useBackground = backgroundImageUrl && backgroundSize.width > 0 && backgroundSize.height > 0;

        let height = Math.max(MIN_HEIGHT, graphSize.height);
        let width = Math.max(MIN_WIDTH, graphSize.width);

        if (useBackground) {
            // Scale the SVG to exactly fit the background image
            if (graphAspectRatio - backgroundAspectRatio > THRESHOLD) {
                height = width * (1 / backgroundAspectRatio);
            } else if (graphAspectRatio - backgroundAspectRatio < -THRESHOLD)  {
                width = height * backgroundAspectRatio;
            }
        }

        if (darkBackgroundColors.includes(backgroundColor) ) {
            altTextColor = 'white';
        }

        if (maps.length > 1) {
            backgroundAltText = `Background image for ${maps?.length} connected skillmaps`
        }

        const heightDiff = Math.max(height - graphSize.height, 0) / 2;
        const widthDiff = Math.max(width - graphSize.width, 0) / 2;

        return <div className="skill-graph-wrapper">
            <div className={`skill-graph-content ${useBackground ? "has-background" : ""}`}>
                <MenuBar className="skill-graph-activities" ariaLabel={lf("Skill Map")}>
                    <svg viewBox={`-${widthDiff + padding} -${heightDiff + padding} ${width + padding * 2} ${height + padding * 2}`} preserveAspectRatio="xMidYMid meet">
                        {graphs.map((el, i) => {
                            translateY += el.height;
                            return <g key={i} transform={`translate(0, ${translateY - el.height})`}>
                                <SkillGraph unit={UNIT} {...el} />
                            </g>
                        })}
                    </svg>
                </MenuBar>
                {backgroundImageUrl && <div className="skill-graph-background">
                    <img src={backgroundImageUrl} alt={lf(backgroundAltText)} onLoad={this.onImageLoad} style={{ color: altTextColor}} />
                </div>}
            </div>
        </div>
    }
}


function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};

    const props = ownProps as SkillGraphContainerProps

    // Compute graph layout, update size of skill map
    const graphs = props.maps.map(el => getGraph(el));
    const width = graphs?.length ? graphs.map(el => el.width).reduce((prev, curr) => Math.max(prev, curr)) : 0;
    const height = graphs?.length ? graphs.map(el => el.height).reduce((prev, curr) => prev + curr) : 0;

    return {
        graphs,
        graphSize: { width, height }
    }
}

export const SkillGraphContainer = connect(mapStateToProps)(SkillGraphContainerImpl);