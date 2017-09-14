import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"
import * as blockspreview from "./blockspreview"

const lf = pxt.Util.lf;
const repeat = pxt.Util.repeatMap;

export interface CodeCardState { }

export class CodeCardView extends React.Component<pxt.CodeCard, CodeCardState> {

    constructor(props: pxt.CodeCard) {
        super(props);

        this.state = {};
    }

    componentDidUpdate() {
        ($('.ui.embed') as any).embed();
    }

    componentDidMount() {
        const card = this.props
        if (card.hoverButton || card.hoverIcon) {
            $('.ui.card .ui.image .carddimmer').dimmer({
                on: 'hover'
            });
        }
    }

    render() {
        const card = this.props
        let color = card.color || "";
        if (!color) {
            if (card.hardware && !card.software) color = 'black';
            else if (card.software && !card.hardware) color = 'teal';
        }
        const renderMd = (md: string) => md.replace(/`/g, '');
        const url = card.url ? /^[^:]+:\/\//.test(card.url) ? card.url : ('/' + card.url.replace(/^\.?\/?/, ''))
            : undefined;
        const sideUrl = url && /^\//.test(url) ? "#doc:" + url : url;
        const className = card.className;
        const cardType = card.cardType;

        // Hover JSX
        const hoverJSX = (card.hoverButton || card.hoverIcon ?
            <div className="ui dimmer">
                <div className="content">
                    <div className="center">
                        {card.hoverButton ? <div className={`ui inverted button ${card.hoverButtonClass}`}>{card.hoverButton}</div>
                            : <div className="ui icon"><i className={`icon ${card.hoverIcon}`}></i></div>}
                    </div>
                </div>
            </div> : undefined);

        const imageUrl = card.imageUrl || (card.youTubeId ? `https://img.youtube.com/vi/${card.youTubeId}/maxresdefault.jpg` : undefined)

        const cardDiv = <div className={`ui card ${color} ${card.onClick ? "link" : ''} ${className ? className : ''}`} role={card.role} aria-selected={card.role === "option" ? "true" : undefined} aria-label={card.ariaLabel || card.title} title={card.title} onClick={e => card.onClick ? card.onClick(e) : undefined } tabIndex={card.onClick ? card.tabIndex || 0 : null} onKeyDown={card.onClick ? sui.fireClickOnEnter : null}>
            {card.header || card.blocks || card.javascript || card.hardware || card.software || card.any ?
                <div key="header" className={"ui content " + (card.responsive ? " tall desktop only" : "") }>
                    <div className="right floated meta">
                        {card.any ? (<i key="costany" className="ui grey circular label tiny">{card.any > 0 ? card.any : null}</i>) : null}
                        {repeat(card.blocks, (k) => <i key={"costblocks" + k} className="puzzle orange icon" ></i>) }
                        {repeat(card.javascript, (k) => <i key={"costjs" + k} className="align left blue icon" ></i>) }
                        {repeat(card.hardware, (k) => <i key={"costhardware" + k} className="certificate black icon" ></i>) }
                        {repeat(card.software, (k) => <i key={"costsoftware" + k} className="square teal icon" ></i>) }
                    </div>
                    {card.header}
                </div> : null }
            {card.label || card.blocksXml || card.typeScript || imageUrl || cardType == "file" ? <div className={"ui image"}>
                {card.label ? <label className="ui orange right ribbon label">{card.label}</label> : undefined }
                {card.blocksXml ? <blockspreview.BlocksPreview key="promoblocks" xml={card.blocksXml} /> : undefined}
                {card.typeScript ? <pre key="promots">{card.typeScript}</pre> : undefined}
                {imageUrl ? <div className="ui dimmable carddimmer"> {hoverJSX} <div className="ui cardimage" style={ { backgroundImage: `url("${imageUrl}")`}} /> </div> : undefined}
                {card.cardType == "file" ? <div className="ui fileimage" /> : undefined}
            </div> : undefined }
            {card.icon || card.iconContent ?
                <div className="ui"><div className={`ui button massive fluid ${card.iconColor} ${card.iconContent ? "iconcontent" : ""}`}>
                    { card.icon ? <i className={`${'icon ' + card.icon}`}></i> : undefined }
                    { card.iconContent || undefined }
                </div></div> : undefined }
            {card.shortName || card.name || card.description ?
                <div className="content">
                    {card.shortName || card.name ? <div className="header">{card.shortName || card.name}</div> : null}
                    {card.time ? <div className="meta tall">
                        {card.time ? <span key="date" className="date">{pxt.Util.timeSince(card.time) }</span> : null}
                    </div> : undefined}
                    {card.description ? <div className="description tall">{renderMd(card.description) }</div> : null}
                </div> : undefined }
        </div>;

        if (!card.onClick && url) {
            return (
                <div>
                    <a href={url} target="docs" className="ui widedesktop hide">{cardDiv}</a>
                    <a href={sideUrl} className="ui widedesktop only">{cardDiv}</a>
                </div>
            )
        } else {
            return (cardDiv)
        }
    }
}
