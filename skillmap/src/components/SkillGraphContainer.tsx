import * as React from "react";

import { SkillGraph } from "./SkillGraph";

/* eslint-disable import/no-unassigned-import, import/no-internal-modules */
import '../styles/skillgraph.css'
/* eslint-enable import/no-unassigned-import, import/no-internal-modules */

interface SkillGraphContainerProps {
    maps: SkillMap[];
    backgroundImageUrl: string;
}

export class SkillGraphContainer extends React.Component<SkillGraphContainerProps> {
    render() {
        const { maps, backgroundImageUrl } = this.props;

        return <div className="skill-graph-wrapper">
            <div className={`skill-graph-content`}>
                {maps.map((el, i) => {
                        return <SkillGraph map={el} key={i} />
                    })}
            </div>
            <div className="skill-graph-background">
                {backgroundImageUrl &&
                    <img src={backgroundImageUrl} alt={lf("Background Image")}/>
                }
            </div>
        </div>
    }
}