import * as React from "react";
import { classList, ControlProps } from "../util";
import { Button, ButtonProps } from "./Button";

export interface MenuItem extends ButtonProps {
    role?: "menuitem" | undefined;
    ariaPosInSet?: undefined;
    ariaSetSize?: undefined;
}

export interface MenuDropdownProps extends ControlProps {
    id: string;
    items: MenuItem[];
    label?: string | JSX.Element;
    title: string;
    icon?: string;
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
        icon
    } = props;

    const focusableElements: HTMLElement[] = [];
    let expandButton: HTMLButtonElement;

    const handleRef = (ref: HTMLButtonElement) => {
        if (!ref) return;

        expandButton = ref;
    }

    const createMenuItemRefHandler = (index: number) =>
        (ref: HTMLButtonElement) => {
            if (!ref) return;
            ref.setAttribute("tabindex", "-1")
            focusableElements[index] = ref;
        };

    const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
        if  (!focusableElements?.length) return;

        const target = document.activeElement as HTMLElement;
        const index = focusableElements.indexOf(target);

        if (index === -1 && target !== expandButton) return;

        if (e.key === "Enter" || e.key === " ") {
            target.click();
            e.preventDefault();
            e.stopPropagation();
        }
        else if (e.key === "ArrowDown") {
            if (index === focusableElements.length - 1 || target === expandButton) {
                if (!expanded) setExpanded(true);
                focusableElements[0].focus();
            }
            else {
                focusableElements[index + 1].focus();
            }
            e.preventDefault();
            e.stopPropagation();
        }
        else if (e.key === "ArrowUp") {
            if (index === 0 || target === expandButton) {
                if (!expanded) setExpanded(true);
                focusableElements[focusableElements.length - 1].focus();
            }
            else {
                focusableElements[Math.max(index - 1, 0)].focus();
            }
            e.preventDefault();
            e.stopPropagation();
        }
        else if (e.key === "Home") {
            focusableElements[0].focus();
            e.preventDefault();
            e.stopPropagation();
        }
        else if (e.key === "End") {
            focusableElements[focusableElements.length - 1].focus();
            e.preventDefault();
            e.stopPropagation();
        }
    }

    const [ expanded, setExpanded ] = React.useState(false);

    const onMenuButtonClick = () => {
        setExpanded(!expanded);
        if (focusableElements?.length) {
            focusableElements[0].focus();
        }
    }

    const classes = classList("common-menu-dropdown", className);
    const menuId = id + "-menu";

    return <div className={classes}>
        <Button
            id={id}
            ref={handleRef}
            onKeydown={onKeyDown}
            label={label}
            title={title}
            leftIcon={icon}
            role={role || "menuitem"}
            className="menu-button"
            onClick={onMenuButtonClick}
            ariaHasPopup="true"
            ariaExpanded={expanded}
            ariaControls={expanded ? menuId : undefined}
            ariaLabel={ariaLabel}
            ariaHidden={ariaHidden}
            />
        {expanded &&
            <div role="menu"
                className="common-menu-dropdown-pane"
                tabIndex={0}
                id={menuId}
                aria-labelledby={id}>
                <ul role="presentation">
                    { items.map((item, index) =>
                        <li key={index} role="presentation">
                            <Button
                                ref={createMenuItemRefHandler(index)}
                                {...item}
                                className={classList("common-menu-dropdown-item", item.className)}
                                onClick={() => {
                                    setExpanded(false);
                                    item.onClick();
                                }}
                                onKeydown={onKeyDown}
                                role="menuitem"
                                ariaPosInSet={index + 1}
                                ariaSetSize={items.length}/>
                        </li>
                    )}
                </ul>
            </div>
        }
    </div>
}