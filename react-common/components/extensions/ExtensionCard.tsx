import * as React from "react";


interface ExtensionCardProps extends pxt.CodeCard {
    scr: pxtc.service.ExtensionMeta;
    onCardClick: (scr: any) => void;
    loading?: boolean;
}

export const ExtensionCard = (props: ExtensionCardProps) => {
    const handleClick = () => {
        props.onCardClick(props.scr);
    }

    const handleLearnMoreClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        window.open(props.learnMoreUrl, "_blank")
    }

    return <div className={(props.loading ? "loading ": "") +"ui card extensionCard"} onClick={handleClick}>
        <img src={props.imageUrl}/>
        <div className="content">
            <div className="name">{props.name}</div>
            <div className="description">{props.description}</div>
        </div>

        {props.learnMoreUrl ?
            <div className="extra content">
                <a className="learnmore" onClick={handleLearnMoreClick} rel="noopener noreferrer">{lf("Learn More")}</a>
            </div>: undefined}
    </div>
}