import * as React from 'react';
import { fireClickOnlyOnEnter } from './util';

export interface ButtonProps {
    title: string;
    iconClass: string;
    onClick?: () => void;

    toggle?: boolean;
    disabled?: boolean;
    noTab?: boolean;
}

export const IconButton = (props: ButtonProps) => {
    const { title, iconClass, onClick, toggle, disabled, noTab } = props;

    return (
        <div
            role="button"
            className={`image-editor-button ${toggle ? "toggle" : ""} ${disabled ? "disabled" : ""}`}
            title={title}
            tabIndex={(noTab || disabled) ? -1 : 0}
            onClick={onClick}
            onKeyDown={fireClickOnlyOnEnter}>
                <span className={iconClass} />
        </div>
    );
}
