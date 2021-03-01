import * as React from "react";

import { SkillGraph } from "./SkillGraph";

/* tslint:disable:no-import-side-effect */
import '../styles/skillgraph.css'
/* tslint:enable:no-import-side-effect */

interface SkillGraphContainerProps {
    maps: SkillMap[];
}

export class SkillGraphContainer extends React.Component<SkillGraphContainerProps> {
    render() {
        const { maps } = this.props;

        return <div className="skill-graph-wrapper">
            <div className={`skill-graph-content`}>
                {maps.map((el, i) => {
                        return <SkillGraph map={el} key={i} />
                    })}
            </div>
            <div className="skill-graph-background">
                {/* TEMP: this div will be replaced by the background image url from markdown */}
                <div className="background-img"></div>
            </div>
        </div>
    }
}