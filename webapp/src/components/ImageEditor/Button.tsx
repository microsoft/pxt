import * as React from 'react';

export interface ButtonProps {
    title: string;
    iconClass: string;
    onClick?: () => void;

    toggle?: boolean;
    disabled?: boolean;
}

export class IconButton extends React.Component<ButtonProps, {}> {
    render() {
        const { title, iconClass, onClick, toggle, disabled } = this.props;

        return (
            <div
                role="button"
                className={`image-editor-button ${toggle ? "toggle" : ""} ${disabled ? "disabled" : ""}`}
                title={title}
                onClick={onClick}>
                    <span className={iconClass} />
            </div>
        );
    }
}
