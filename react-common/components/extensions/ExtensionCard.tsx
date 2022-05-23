import * as React from "react";
import { Button } from "../controls/Button";
import { Card } from "../controls/Card";
import { LazyImage } from "../controls/LazyImage";
import { classList } from "../util";

export interface ExtensionCardProps<U> {
    title: string;
    description: string;
    imageUrl?: string;
    learnMoreUrl?: string;
    label?: string;
    onClick?: (value: U) => void;
    extension?: U;
    loading?: boolean;
}

export const ExtensionCard = <U,>(props: ExtensionCardProps<U>) => {
    const {
        title,
        description,
        imageUrl,
        learnMoreUrl,
        label,
        onClick,
        extension,
        loading
    } = props;

    const onCardClick = () => {
        if (onClick) onClick(extension);
    }

    const id = pxt.Util.guidGen();

    return <>
        <Card
            className={classList("common-extension-card", loading && "loading")}
            onClick={onCardClick}
            ariaLabelledBy={id + "-title"}
            ariaDescribedBy={id + "-description"}
            tabIndex={onClick && 0}
            label={label}>
            <div className="common-extension-card-contents">
                {!loading && <>
                    {imageUrl && <LazyImage src={imageUrl} alt={title} />}
                    <div className="common-extension-card-title" id={id + "-title"}>
                        {title}
                    </div>
                    <div className="common-extension-card-description">
                        <div id={id + "-description"}>
                            {description}
                        </div>
                    </div>
                    {learnMoreUrl &&
                        <Button
                            className="link-button"
                            label={lf("Learn More")}
                            title={lf("Learn More")}
                            onClick={() => { }}
                            href={learnMoreUrl}
                        />
                    }
                </>
                }
            </div>
            <div className="common-spinner" />
        </Card>
    </>
}