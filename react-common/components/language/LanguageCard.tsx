import * as React from "react";
import { Button } from "../controls/Button";

interface LanguageCardProps {
    langId: string;
    name: string;
    ariaLabel: string;
    description: string;
    onClick: (langId: string) => void;
}

export class LanguageCard extends React.Component<LanguageCardProps> {

    constructor(props: LanguageCardProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick() {
        this.props.onClick(this.props.langId);
    }

    render() {
        const { name, ariaLabel, description } = this.props;
        return (
            <Button
                className="ui card link card-selected language-card"
                onClick={this.handleClick}
                role="listitem"
                ariaLabel={ariaLabel}
                title={name}
                label={
                <div className="language-card-container">
                    <div className="language-card-header">{name}</div>
                    <div className="language-card-description ui desktop only">
                        {description}
                    </div>
                </div>
                }
            />
        );
    }
}
