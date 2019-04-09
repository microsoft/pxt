import * as React from "react";
import * as sui from "./sui";
import * as data from "./data";

const repeat = pxt.Util.repeatMap;

export interface CodeCardState { }

export class CodeCardView extends data.Component<pxt.CodeCard, CodeCardState> {

    public element: HTMLDivElement;

    constructor(props: pxt.CodeCard) {
        super(props);

        this.state = {};
    }

    private static observer: IntersectionObserver;
    private static setupIntersectionObserver() {
        if (this.observer) return;
        // setup intersection observer for the image
        const preloadImage = (el: HTMLImageElement) => {
            const lazyImageUrl = el.getAttribute('data-src');
            el.style.backgroundImage = `url(${lazyImageUrl})`
        }
        const config = {
            // If the image gets within 50px in the Y axis, start the download.
            rootMargin: '50px 0px',
            threshold: 0.01
        };
        const onIntersection: IntersectionObserverCallback = (entries) => {
            entries.forEach(entry => {
                // Are we in viewport?
                if (entry.intersectionRatio > 0) {
                    // Stop watching and load the image
                    this.observer.unobserve(entry.target);
                    preloadImage(entry.target as HTMLImageElement);
                }
            })
        }
        this.observer = new IntersectionObserver(onIntersection, config);
    }

    componentDidMount() {
        const lazyImage = this.refs.lazyimage as HTMLImageElement;
        if (!lazyImage) return;

        if (!('IntersectionObserver' in window)) {
            // No intersection observer support, set the image url immediately
            const lazyImageUrl = lazyImage.getAttribute('data-src');
            lazyImage.style.backgroundImage = `url(${lazyImageUrl})`
        } else {
            CodeCardView.setupIntersectionObserver();
            CodeCardView.observer.observe(lazyImage);
        }
    }

    renderCore() {
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
        const tutorialDone = card.tutorialLength == card.tutorialStep + 1;

        const clickHandler = card.onClick ? (e: any) => {
            if (e.target && e.target.tagName == "A")
                return;
            pxt.analytics.enableCookies();
            card.onClick(e);
        } : undefined;

        const imageUrl = card.imageUrl || (card.youTubeId ? `https://img.youtube.com/vi/${card.youTubeId}/0.jpg` : undefined);

        const cardDiv = <div className={`ui card ${color} ${card.onClick ? "link" : ''} ${className ? className : ''}`}
            role={card.role} aria-selected={card.role === "option" ? "true" : undefined} aria-label={card.ariaLabel || card.title} title={card.title}
            onClick={clickHandler} tabIndex={card.onClick ? card.tabIndex || 0 : null} onKeyDown={card.onClick ? sui.fireClickOnEnter : null}>
            {card.header || card.blocks || card.javascript || card.hardware || card.software || card.any ?
                <div key="header" className={"ui content " + (card.responsive ? " tall desktop only" : "")}>
                    <div className="right floated meta">
                        {card.any ? (<sui.Icon key="costany" icon="ui grey circular label tiny">{card.any > 0 ? card.any : null} </sui.Icon>) : null}
                        {repeat(card.blocks, (k) => <sui.Icon key={"costblocks" + k} icon="puzzle orange" />)}
                        {repeat(card.javascript, (k) => <sui.Icon key={"costjs" + k} icon="align left blue" />)}
                        {repeat(card.hardware, (k) => <sui.Icon key={"costhardware" + k} icon="certificate black" />)}
                        {repeat(card.software, (k) => <sui.Icon key={"costsoftware" + k} icon="square teal" />)}
                    </div>
                    {card.header}
                </div> : null}
            {card.label || card.labelIcon || card.blocksXml || card.typeScript || imageUrl || cardType == "file" ? <div className={"ui image"}>
                {card.label || card.labelIcon ?
                    <label role={card.onLabelClicked ? 'button' : undefined} onClick={card.onLabelClicked}
                        className={`ui ${card.labelClass ? card.labelClass : "orange right ribbon"} label`}>
                        {card.labelIcon ? <sui.Icon icon={card.labelIcon} /> : card.label}</label> : undefined}
                {card.typeScript ? <pre key="promots">{card.typeScript}</pre> : undefined}
                {card.cardType != "file" && imageUrl ? <div className="ui imagewrapper">
                    <div className={`ui cardimage`} data-src={imageUrl} ref="lazyimage" />
                </div> : undefined}
                {card.cardType == "file" && !imageUrl ? <div className="ui fileimage" /> : undefined}
                {card.cardType == "file" && imageUrl ? <div className="ui fileimage" data-src={imageUrl} ref="lazyimage" /> : undefined}
            </div> : undefined}
            {card.icon || card.iconContent ?
                <div className="ui imagewrapper"><div className={`ui button massive fluid ${card.iconColor} ${card.iconContent ? "iconcontent" : ""}`}>
                    {card.icon ? <sui.Icon icon={`${'icon ' + card.icon}`} /> : undefined}
                    {card.iconContent || undefined}
                </div></div> : undefined}
            {card.shortName || card.name || card.description ?
                <div className="content">
                    {card.shortName || card.name ? <div className="header">{card.shortName || card.name}</div> : null}
                    {card.description ? <div className={`description tall ${card.icon || card.iconContent || card.imageUrl ? "" : "long"}`}>{renderMd(card.description)}</div> : null}
                </div> : undefined}
            {card.time ? <div className="meta">
                {card.tutorialLength ? <span className={`ui tutorial-progress ${tutorialDone ? "green" : "orange"} left floated label`}><i className={`${tutorialDone ? "trophy" : "circle"} icon`}></i>&nbsp;{lf("{0}/{1}", (card.tutorialStep || 0) + 1, card.tutorialLength)}</span> : undefined}
                {card.time ? <span key="date" className="date">{pxt.Util.timeSince(card.time)}</span> : null}
            </div> : undefined}
            {card.extracontent || card.learnMoreUrl || card.buyUrl || card.feedbackUrl ?
                <div className="ui extra content mobile hide">
                    {card.extracontent}
                    {card.buyUrl ?
                        <a className="learnmore left floated" href={card.buyUrl}
                            aria-label={lf("Buy")} target="_blank" rel="noopener noreferrer">
                            {lf("Buy")}
                        </a> : undefined}
                    {card.learnMoreUrl ?
                        <a className="learnmore right floated" href={card.learnMoreUrl}
                            aria-label={lf("Learn more")} target="_blank" rel="noopener noreferrer">
                            {lf("Learn more")}
                        </a> : undefined}
                    {card.feedbackUrl ?
                        <a className="learnmore right floated" href={card.feedbackUrl}
                            aria-label={lf("Feedback")} target="_blank" rel="noopener noreferrer">
                            {lf("Feedback")}
                        </a> : undefined}
                </div> : undefined}
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
