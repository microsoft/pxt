import * as React from "react";
import * as sui from "./sui";
import * as data from "./data";
import * as cloud from "./cloud";
import { fireClickOnEnter } from "./util";

const repeat = pxt.Util.repeatMap;

export interface CodeCardState { }

interface CodeCardProps extends pxt.CodeCard {
    tallCard?: boolean;
}

export class CodeCardView extends data.Component<CodeCardProps, CodeCardState> {

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
        const renderMd = (md: string) => md.replace(/`/g, '');
        const url = card.url ? /^[^:]+:\/\//.test(card.url) ? card.url : ('/' + card.url.replace(/^\.?\/?/, ''))
            : undefined;
        const className = card.className;
        const cardType = card.cardType;
        const tutorialDone = card.tutorialLength == card.tutorialStep + 1;

        const descriptions = card && card.description && card.description.split("\n");

        const clickHandler = card.onClick ? (e: any) => {
            if (e.target && e.target.tagName == "A")
                return;
            pxt.setInteractiveConsent(true);
            card.onClick(e);
        } : undefined;

        const keydownHandler = (e: React.KeyboardEvent) => {
            const charCode = (typeof e.which == "number") ? e.which : e.keyCode;
            if (charCode === /*enter*/13 || charCode === /*space*/32) {
                clickHandler(e);
            }
        }

        const imageUrl = card.imageUrl || (card.youTubeId ? `https://img.youtube.com/vi/${card.youTubeId}/0.jpg` : undefined);

        // these header-derived properties must be taken from the virtual API system, not the props. Otherwise
        // they won't update dynamically when headers change.
        const header = card.projectId ? this.getData<pxt.workspace.Header>(`header:${card.projectId}`) : null;
        const name = header ? header.name : card.name;
        const cloudMd = card.projectId ? this.getData<cloud.CloudTempMetadata>(`${cloud.HEADER_CLOUDSTATE}:${card.projectId}`) : null;
        const cloudStatus = cloudMd?.cloudStatus();
        const lastCloudSave = cloudStatus ? Math.min(header.cloudLastSyncTime, header.modificationTime) : card.time;
        const cloudShowTimestamp = cloudStatus && (cloudStatus.value === "synced" || cloudStatus.value === "justSynced" || cloudStatus.value === "localEdits");

        const ariaLabel = card.ariaLabel || card.title || card.shortName || name;
        const ariaExpanded = !card.directOpen && card.selected !== undefined ? card.selected : undefined;

        const style = card.style || "card"

        const renderButton = (content: JSX.Element) => {
            return (<div className={`ui ${style} ${color} ${card.onClick ? "link" : ''} ${className ? className : ''}`}
                role={card.role} aria-selected={card.role === "option" ? "true" : undefined} aria-label={ariaLabel} aria-expanded={ariaExpanded} title={card.title}
                onClick={clickHandler} tabIndex={card.onClick ? card.tabIndex || 0 : null} onKeyDown={keydownHandler}>{content}</div>)
        }
        const renderLink = (content: JSX.Element) => {
            return (<a href={url} className={`ui ${style} ${color} link ${className ? className : ''}`}
                aria-label={ariaLabel} aria-expanded={ariaExpanded} title={card.title}>{content}</a>)
        }

        const cardContent = <>
            {card.header ?
                <div key="header" className={"ui content " + (card.responsive ? " tall desktop only" : "")}>
                    {card.header}
                </div> : null}
            {card.label || card.labelIcon || card.blocksXml || card.typeScript || imageUrl || cardType == "file" ? <div className={"ui image"}>
                {card.label || card.labelIcon ?
                    <label role={card.onLabelClicked ? 'button' : undefined} onClick={card.onLabelClicked}
                        className={`ui ${card.labelClass ? card.labelClass : "orange right ribbon"} label`}
                        aria-label={`${ariaLabel} ${card.onLabelClicked ? "button" : "label"}`}
                    >
                        {card.labelIcon ? <sui.Icon icon={card.labelIcon} /> : card.label}
                    </label> : undefined}
                {card.typeScript ? <pre key="promots">{card.typeScript}</pre> : undefined}
                {card.cardType != "file" && imageUrl ? <div className="ui imagewrapper" aria-hidden={true} role="presentation">
                    <div className={`ui cardimage`} data-src={imageUrl} ref="lazyimage" aria-hidden={true} role="presentation" />
                </div> : undefined}
                {card.cardType == "file" && !imageUrl ? <div className="ui fileimage" /> : undefined}
                {card.cardType == "file" && imageUrl ? <div className="ui fileimage" data-src={imageUrl} ref="lazyimage" /> : undefined}
            </div> : undefined}
            {card.icon || card.iconContent ?
                <div className="ui imagewrapper" aria-hidden={true} role="presentation">
                    <div className={`ui button massive fluid ${card.iconColor} ${card.iconContent ? "iconcontent" : ""}`}
                        aria-hidden={true} role="presentation" >
                        {card.icon ? <sui.Icon icon={`${'icon ' + card.icon}`} /> : undefined}
                        {card.iconContent || undefined}
                    </div>
                </div> : undefined}
            {(card.shortName || name || descriptions) ?
                <div className={`content ${this.props.tallCard? "tall" : ""}`}>
                    {card.shortName || name ? <div className="header">{card.shortName || name}
                            <div className="tags">{card.tags?.join(" ")}</div>
                        </div> : null}
                    {descriptions && descriptions.map((element, index) => {
                        return <div key={`line${index}`} className={`description tall ${card.icon || card.iconContent || card.imageUrl ? "" : "long"}`}>{renderMd(element)}</div>
                    })
                    }
                </div> : undefined}
            {card.time ? <div className="meta">
                {card.tutorialLength ? <span className={`ui tutorial-progress ${tutorialDone ? "green" : "not-finished"} left floated label`}><i className={`${tutorialDone ? "trophy" : "circle"} icon`}></i>&nbsp;{lf("{0}/{1}", (card.tutorialStep || 0) + 1, card.tutorialLength)}</span> : undefined}
                {!cloudStatus && card.time && <span key="date" className="date">{pxt.Util.timeSince(card.time)}</span>}
                {cloudStatus && cloudShowTimestamp &&
                    <span key="date" className={`date ${card.tutorialLength ? "small-screen hide" : ""}`}>{pxt.Util.timeSince(lastCloudSave)}{cloudStatus.indicator}</span>
                }
                {cloudStatus && !cloudShowTimestamp &&
                    <span key="date" className="date">{cloudStatus.indicator}</span>
                }
                {cloudStatus &&
                    // TODO: alternate icons depending on state
                    <i className="ui large right floated icon cloud"></i>
                }
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
                            tabIndex={0}
                            aria-label={lf("Learn more")} target="_blank" rel="noopener noreferrer">
                            {lf("Learn more")}
                        </a> : undefined}
                    {card.feedbackUrl ?
                        <a className="learnmore right floated" href={card.feedbackUrl}
                            aria-label={lf("Feedback")} target="_blank" rel="noopener noreferrer">
                            {lf("Feedback")}
                        </a> : undefined}
                </div> : undefined}
        </>;

        if (!card.onClick && url) {
            return (renderLink(cardContent))
        } else {
            return (renderButton(cardContent))
        }
    }
}
