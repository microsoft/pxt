import * as React from "react";
import { Button } from "../controls/Button";
import { Card } from "../controls/Card";
import { LazyImage } from "../controls/LazyImage";

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
        extension
    } = props;

    const onCardClick = () => {
        if (onClick) onClick(extension);
    }

    return <>
        <Card
            className="common-extension-card"
            onClick={onCardClick}>
            <LazyImage src={imageUrl} alt={title} />
            <div className="common-extension-card-title">
                {title}
            </div>
            <div className="common-extension-card-description">
                <div>
                    {description}
                </div>
            </div>
            {learnMoreUrl &&
                <Button
                    className="link-button"
                    label={lf("Learn More")}
                    title={lf("Learn More")}
                    onClick={() => {}}
                    href={learnMoreUrl}
                />
            }
        </Card>
    </>
}