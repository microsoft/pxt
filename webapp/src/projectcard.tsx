import * as React from "react";
import * as ReactDOM from "react-dom";
import * as simsvg from "./simsvg";
import * as simview from "./simview"
import * as sui from "./sui"

let lf = yelm.Util.lf;

export interface ProjectCardProps {
    cfg : yelm.PackageConfig;
}
export interface ProjectCardState { }

export class ProjectCard extends React.Component<ProjectCardProps, ProjectCardState> {

    constructor(props: ProjectCardProps) {
        super(props);

        this.state = {};
    }

    render() {
        var cfg = this.props.cfg;
        return (
            <div className="ui card">
                <div className="image">
                    <simview.MbitBoardView disableTilt={true} theme={simsvg.randomTheme()} />
                </div>
                <div className="content">
                    <a className="header">{cfg.name}</a>
                    <div className="meta">
                        <span className="date">{cfg.installedVersion}</span>
                    </div>
                    <div className="description">{cfg.description ? cfg.description : lf("No description.")}</div>
                </div>
                <div className="extra content">
                    <a>
                    <i className="user icon"></i>
                    {cfg.public ? lf("public") : lf("")}
                    </a>
                </div>
            </div>
        )
    }
}
