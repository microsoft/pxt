import * as React from "react";
import { classList, ControlProps } from "../util";
import { Button, ButtonProps } from "./Button";
import { FocusTrap } from "./FocusTrap";

export interface MenuItem extends ButtonProps {
    role?: "menuitem" | undefined;
    ariaPosInSet?: undefined;
    ariaSetSize?: undefined;
}

export interface MenuDropdownProps extends ControlProps {
    id?: string;
    items: MenuItem[];
    label?: string | JSX.Element;
    title: string;
    icon?: string;
    tabIndex?: number;
    disabled?: boolean;
}

export const MenuDropdown = (props: MenuDropdownProps) => {
    const {
        id,
        className,
        ariaHidden,
        ariaLabel,
        role,
        items,
        label,
        title,
        icon,
        tabIndex,
        disabled
    } = props;

    const [ expanded, setExpanded ] = React.useState(false);

    let container: HTMLDivElement;
    let expandButton: HTMLButtonElement;

    const handleContainerRef = (ref: HTMLDivElement) => {
        if (!ref) return;
        container = ref;
    }

    const handleButtonRef = (ref: HTMLButtonElement) => {
        if (!ref) return;
        expandButton = ref;
    }

    const onMenuButtonClick = () => {
        setExpanded(!expanded);
    }

    const onSubpaneEscape = () => {
        setExpanded(false);
        if (expandButton) expandButton.focus();
    }

    const onBlur = (e: React.FocusEvent) => {
        if (!container) return;
        if (expanded && !container.contains(e.relatedTarget as HTMLElement)) setExpanded(false);
    }

    const classes = classList("common-menu-dropdown", className);
    const menuId = id + "-menu";

    return <div className={classes} ref={handleContainerRef} onBlur={onBlur}>
        <Button
            id={id}
            label={label}
            tabIndex={tabIndex}
            buttonRef={handleButtonRef}
            title={title}
            leftIcon={icon}
            role={role || "menuitem"}
            className={classList("menu-button", expanded && "expanded")}
            onClick={onMenuButtonClick}
            ariaHasPopup="true"
            ariaExpanded={expanded}
            ariaControls={expanded ? menuId : undefined}
            ariaLabel={ariaLabel}
            ariaHidden={ariaHidden}
            disabled={disabled}
            />
        {expanded &&
            <div role="menu"
                className="common-menu-dropdown-pane"
                tabIndex={0}
                id={menuId}
                aria-labelledby={id}>
                <FocusTrap arrowKeyNavigation={true} onEscape={onSubpaneEscape}>
                    <ul role="presentation">
                        { items.map((item, index) =>
                            <li key={index} role="presentation">
                                <Button
                                    {...item}
                                    className={classList("common-menu-dropdown-item", item.className)}
                                    onClick={() => {
                                        setExpanded(false);
                                        item.onClick();
                                    }}
                                    role="menuitem"
                                    ariaPosInSet={index + 1}
                                    ariaSetSize={items.length}/>
                            </li>
                        )}
                    </ul>
                </FocusTrap>
            </div>
        }
    </div>
}