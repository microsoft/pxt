import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"
import * as blockspreview from "./blockspreview"

let lf = yelm.Util.lf;
let repeat = yelm.Util.repeatMap;

interface SocialNetwork {
    parse: (text: string) => { source: string; id: string }
}

let socialNetworks: SocialNetwork[] = [{
    parse: text => {
        let links: string[] = [];
        if (text)
            text.replace(/https?:\/\/(youtu\.be\/([a-z0-9\-_]+))|(www\.youtube\.com\/watch\?v=([a-z0-9\-_]+))/i,
                (m, m2, id1, m3, id2) => {
                    var ytid = id1 || id2;
                    links.push(ytid); return ''
                });
        if(links[0]) return {source:'youtube', id:links[0]};
        else return undefined;
    }
}, {
    parse: text => {
        let m = /https?:\/\/vimeo\.com\/\S*?(\d{6,})/i.exec(text)
        if (m) return { source:"vimeo", id:m[1]};
        else return undefined;
    }
}
];



export interface CodeCardProps {
    name: string;
    
    description?: string;
    promoUrl?: string;
    blocksXml?: string;
    header?: string;
    time?: number;
    card?: yelm.PackageCard;
    url?: string;
}
export interface CodeCardState { }

export class CodeCard extends React.Component<CodeCardProps, CodeCardState> {

    constructor(props: CodeCardProps) {
        super(props);

        this.state = {};
    }

    componentDidUpdate() {
        ($('.ui.embed') as any).embed();
    }

    render() {
        let card = this.props.card || {}
        let promo = socialNetworks.map(sn => sn.parse(card.promoUrl)).filter(p => !!p)[0];        

        return (
            <div className="ui card">
                <div className="content">
                    <div className="right floated meta">
                        {card.any ? (<i key="costany" className="ui grey circular label tiny">{card.any > 0 ? card.any : ""}</i>) : ""}
                        {repeat(card.hardware, (k) => <i key={"costhardware" + k} className="certificate black icon" ></i>) }
                        {repeat(card.software, (k) => <i key={"costsoftware" + k} className="square teal icon" ></i>) }
                    </div>
                    {this.props.header || this.props.name}
                </div>
                <div className="image">
                    {promo ? <div key="promoembed" className="ui embed" data-source={promo.source} data-id={promo.id}></div>
                        : this.props.blocksXml 
                        ? <blockspreview.BlocksPreview key="promoblocks" xml={this.props.blocksXml} />
                        : null // <simview.MicrobitBoardView key="promosim" disableTilt={true} theme={simsvg.randomTheme() } />
                    }
                </div>
                <div className="content">
                    <a className="header">{this.props.name}</a>
                    <div className="meta">
                        {this.props.time ? <span key="date" className="date">{yelm.Util.timeSince(this.props.time) }</span> : ""}
                    </div>
                    <div className="description">{this.props.description || lf("No description.") }</div>
                </div>
                <div className="extra content">
                    {card.power || card.toughness ? (<div key="powertough" className="right floated meta">{card.power || 0}/{card.toughness || 0}</div>) : ""}
                    <a target="_blank" href={this.props.url || "https://yelm.io/"}>
                        {this.props.url || "yelm.io"}
                    </a>
                </div>
            </div>
        )
    }
}
