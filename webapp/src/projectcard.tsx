import * as React from "react";
import * as ReactDOM from "react-dom";
import * as simsvg from "./simsvg";
import * as simview from "./simview"
import * as sui from "./sui"

let lf = yelm.Util.lf;
let repeat = yelm.Util.repeatMap;

export interface ProjectCardProps {
    url?:string;
    username:string;
    cfg : yelm.PackageConfig;
}
export interface ProjectCardState { }

export class ProjectCard extends React.Component<ProjectCardProps, ProjectCardState> {

    constructor(props: ProjectCardProps) {
        super(props);

        this.state = {};
    }

    render() {
        let cfg = this.props.cfg;
        let card = cfg.card || {}
        return (
            <div className="ui card">
                <div className="content">
                    <div className="right floated meta">
                        {card.any ? (<i className="any icon">{card.any > 0 ? card.any : ""}</i>) : ""}
                        {repeat(card.hardware, () => <i className="small certificate black icon" ></i>)}
                        {repeat(card.software, () => <i className="small square teal icon" ></i>)}
                    </div>
                    {this.props.username}
                </div>
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
                    {card.power || card.toughness ? (<div className="right floated meta">{card.power || 0}/{card.toughness || 0}</div>) : ""}
                    <a href={this.props.url || "https://yelm.io/"}>
                            {this.props.url || "yelm.io"}
                    </a>
                </div>
            </div>
        )
    }
}
