import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"
import * as blockspreview from "./blockspreview"

let lf = pxt.Util.lf;
let repeat = pxt.Util.repeatMap;

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


export interface CodeCardState { }

export class CodeCardView extends React.Component<pxt.CodeCard, CodeCardState> {

    constructor(props: pxt.CodeCard) {
        super(props);

        this.state = {};
    }

    componentDidUpdate() {
        ($('.ui.embed') as any).embed();
    }

    render() {
        let card = this.props
        let promo = socialNetworks.map(sn => sn.parse(card.promoUrl)).filter(p => !!p)[0];        
        let color = card.color || "";
        if (!color) {
            if (card.hardware && !card.software) color = 'black';
            else if (card.software && !card.hardware) color = 'teal';
        }
        let url = card.url ? /^[^:]+:\/\//.test(card.url) ? card.url : ('/' + card.url.replace(/^\.?\/?/,''))
            : undefined;

        return (
            <div className={"ui card " + color + (card.onClick ? " link" : '') + (card.className ? (' ' + card.className) : '')} onClick={e => card.onClick ? card.onClick(e) : undefined } >
                {card.header || card.blocks || card.javascript || card.hardware || card.software || card.any ?
                <div key="header" className={"ui content " + (card.responsive ? " tall desktop only" : "")}>
                    <div className="right floated meta">
                        {card.any ? (<i key="costany" className="ui grey circular label tiny">{card.any > 0 ? card.any : ""}</i>) : ""}
                        {repeat(card.blocks, (k) => <i key={"costblocks" + k} className="puzzle oragne icon" ></i>) }
                        {repeat(card.javascript, (k) => <i key={"costjs" + k} className="keyboard blue icon" ></i>) }
                        {repeat(card.hardware, (k) => <i key={"costhardware" + k} className="certificate black icon" ></i>) }
                        {repeat(card.software, (k) => <i key={"costsoftware" + k} className="square teal icon" ></i>) }
                    </div>
                    {card.header}
                </div> : "" }
                <div className={"ui image" + (card.responsive ? " tall landscape only": "")}>
                    {promo ? <div key="promoembed" className="ui embed" data-source={promo.source} data-id={promo.id}></div> : ''}
                    {card.blocksXml  ? <blockspreview.BlocksPreview key="promoblocks" xml={card.blocksXml} /> : '' }
                    {card.typeScript ? <pre key="promots">{card.typeScript}</pre> : '' }
                </div>
                <div className="content">
                    {card.name ? <a href={card.onClick ? '' : url} target="docs" className="header">{card.name}</a> : ''}
                    <div className="meta">
                        {card.time ? <span key="date" className="date">{pxt.Util.timeSince(card.time) }</span> : ""}
                    </div>
                    {card.description ? <div className="description">{card.description}</div> : ''}
                </div>
                {card.url ?
                <div key="extra" className={"ui extra content" + (card.responsive ? " tall desktop only" : "")}>
                    {card.url ? <a target="docs" href={card.onClick ? '' : url}>{card.url}</a> : ""}
                </div> : ""}
            </div>
        )
    }
}
