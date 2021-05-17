import * as React from "react";

import { SkillGraph } from "./SkillGraph";
import { SvgCoord, orthogonalGraph } from '../lib/skillGraphUtils';

/* eslint-disable import/no-unassigned-import, import/no-internal-modules */
import '../styles/skillgraph.css'
/* eslint-enable import/no-unassigned-import, import/no-internal-modules */

interface SvgGraph {
    map: SkillMap;
    items: SvgGraphItem[];
    paths: SvgGraphPath[];
    width: number;
    height: number
}

export interface SvgGraphItem {
    activity: MapActivity;
    position: SvgCoord;
}

export interface SvgGraphPath {
    points: SvgCoord[];
}

interface SkillGraphContainerProps {
    maps: SkillMap[];
    backgroundImageUrl: string;
}

interface SkillGraphContainerState {
    backgroundSize: {
        width: number,
        height: number
    };
}

const UNIT = 10;
const PADDING = 4;
const MIN_HEIGHT = 40 * UNIT;
const MIN_WIDTH = 60 * UNIT;
const THRESHOLD = 0.05;

export class SkillGraphContainer extends React.Component<SkillGraphContainerProps, SkillGraphContainerState> {
    protected graphs: SvgGraph[] = [];
    protected graphSize = { width: 0, height: 0 };

    constructor(props: SkillGraphContainerProps) {
        super(props);

        this.state = { backgroundSize: { width: 0, height: 0 } };
        this.graphs = props.maps.map(el => this.getGraph(el));
    }

    UNSAFE_componentWillReceiveProps(props: SkillGraphContainerProps) {
        this.graphSize = { width: 0, height: 0 };
        this.graphs = props.maps.map(el => this.getGraph(el));
    }

    protected getGraph(map: SkillMap): SvgGraph {
        const nodes = orthogonalGraph(map.root);
        let maxDepth = 0, maxOffset = 0;

        // Convert into renderable items
        const items: SvgGraphItem[] = [];
        const paths: SvgGraphPath[] = [];
        for (let current of nodes) {
            const { depth, offset } = current;
            items.push({
                activity: current,
                position: this.getPosition(depth, offset)
            } as any);

            if (current.edges) {
                current.edges.forEach(edge => {
                    const points: SvgCoord[] = [];
                    edge.forEach(n => points.push(this.getPosition(n.depth, n.offset)));
                    paths.push({ points });
                });
            }

            maxDepth = Math.max(maxDepth, current.depth);
            maxOffset = Math.max(maxOffset, current.offset);
        }

        const width = this.getX(maxDepth) + UNIT * PADDING;
        const height = this.getY(maxOffset) + UNIT * PADDING;

        // Update width of entire skill map, if this graph changes it
        this.graphSize.width = Math.max(this.graphSize.width, width);
        this.graphSize.height += height;

        return { map, items, paths, width, height };
    }

    // This function converts graph position (no units) to x/y (SVG units)
    protected getPosition(depth: number, offset: number): SvgCoord {
        return { x: this.getX(depth), y: this.getY(offset) }
    }

    protected getX(position: number) {
        return ((position * 12) + PADDING) * UNIT;
    }

    protected getY(position: number) {
        return ((position * 9) + PADDING) * UNIT;
    }

    protected onImageLoad = (evt: any) => {
        console.log(evt.target)
        this.setState({
            backgroundSize: {
                    width: evt.target.offsetWidth,
                    height: evt.target.offsetHeight
                }
            })
    }

    render() {
        const { backgroundImageUrl } = this.props;
        const { backgroundSize } = this.state;
        let translateY = 0;

        const padding = PADDING * UNIT;
        const graphAspectRatio = this.graphSize.width / this.graphSize.height;
        const backgroundAspectRatio = backgroundSize.width / backgroundSize.height;

        let height = Math.max(MIN_HEIGHT, this.graphSize.height);
        let width = Math.max(MIN_WIDTH, this.graphSize.width);

        if (backgroundImageUrl) {
            // Scale the SVG to exactly fit the background image
            if (graphAspectRatio - backgroundAspectRatio > THRESHOLD) {
                height = width * (1 / backgroundAspectRatio);
            } else if (graphAspectRatio - backgroundAspectRatio < -THRESHOLD)  {
                width = height * backgroundAspectRatio;
            }
        }

        const heightDiff = Math.max(height - this.graphSize.height, 0) / 2;
        const widthDiff = Math.max(width - this.graphSize.width, 0) / 2;

        return <div className="skill-graph-wrapper">
            <div className={`skill-graph-content ${backgroundImageUrl ? "has-background" : ""}`}>
                <div className="skill-graph-activities">
                    <svg viewBox={`-${widthDiff + padding} -${heightDiff + padding} ${width + padding * 2} ${height + padding * 2}`} preserveAspectRatio="xMidYMid meet">
                        {this.graphs.map((el, i) => {
                            translateY += el.height;
                            return <g key={i} transform={`translate(0, ${translateY - el.height})`}>
                                <SkillGraph unit={UNIT} {...el} />
                            </g>
                        })}
                    </svg>
                </div>
                {backgroundImageUrl && <div className="skill-graph-background">
                    <img src={backgroundImageUrl} alt={lf("Background Image")} onLoad={this.onImageLoad} />
                </div>}
            </div>
        </div>
    }
}