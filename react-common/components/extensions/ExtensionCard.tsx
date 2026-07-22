import * as React from "react";
import { Card } from "../controls/Card";
import { LazyImage } from "../controls/LazyImage";
import { classList } from "../util";
import { Link } from "../controls/Link";

export interface ExtensionCardProps<U> {
    title: string;
    description: string;
    imageUrl?: string;
    learnMoreUrl?: string;
    label?: string;
    labelClass?: string;
    onClick?: (value: U) => void;
    extension?: U;
    loading?: boolean;
    installed?: boolean;
    showDisclaimer?: boolean
}

export const ExtensionCard = <U,>(props: ExtensionCardProps<U>) => {
    const {
        title,
        description,
        imageUrl,
        learnMoreUrl,
        label,
        labelClass,
        onClick,
        extension,
        loading,
        installed,
        showDisclaimer
    } = props;

    const onCardClick = () => {
        if (onClick) onClick(extension);
    }

    const id = pxt.Util.guidGen();
    const cardLabel = installed ? lf("Installed") : label;
    const cardLabelClass = installed ? classList("installed", labelClass) : labelClass;
    const descriptionId = id + "-description";
    const statusId = cardLabel ? id + "-status" : undefined;

    return <>
        <Card
            className={classList("common-extension-card", loading && "loading", installed && "installed")}
            onClick={onCardClick}
            ariaLabelledBy={id + "-title"}
            ariaDescribedBy={classList(descriptionId, statusId)}
            tabIndex={onClick && 0}
            label={cardLabel}
            labelClass={cardLabelClass}>
            <div className="common-extension-card-contents">
                {!loading && <>
                    {imageUrl && <LazyImage src={imageUrl} alt={title} />}
                    <div className="common-extension-card-title" id={id + "-title"} title={title}>
                        {title}
                    </div>
                    <div className="common-extension-card-description">
                        <div id={descriptionId}>
                            {description}
                        </div>
                    </div>
                    {cardLabel && <div id={statusId} className="sr-only">{cardLabel}</div>}
                    {(showDisclaimer || learnMoreUrl) &&
                        <div className="common-extension-card-extra-content">
                            {showDisclaimer && lf("User-provided extension, not endorsed by Microsoft.")}
                            {learnMoreUrl &&
                                <Link
                                    className="link-button"
                                    href={learnMoreUrl}
                                    target="_blank"
                                >
                                    {lf("Learn More")}
                                </Link>
                            }
                        </div>
                    }
                </>
                }
            </div>
            <div className="common-spinner" />
        </Card>
    </>
}