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
        return <Button className={`language-card`} //card-selected langoption
            title={name}
            ariaLabel={ariaLabel}
            role="listitem"
            label={description}
            onClick={this.handleClick}
        />
    }
}
