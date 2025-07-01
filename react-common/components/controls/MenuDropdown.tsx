import * as React from "react";
import { classList, ControlProps, fireClickOnEnter } from "../util";
import { Button, ButtonBody, ButtonProps, inflateButtonProps } from "./Button";
import { FocusTrap } from "./FocusTrap";
import { CheckboxIcon } from "./Checkbox";

export type MenuItem = MenuDropdownItem | MenuSeparatorItem | MenuCheckboxItem | MenuLinkItem;

export interface MenuDropdownItem extends ButtonProps {
    role: "menuitem";
    ariaPosInSet?: undefined;
    ariaSetSize?: undefined;
}

export interface MenuSeparatorItem {
    role: "separator";
    className?: string;
}

export interface MenuCheckboxItem extends ControlProps {
    role: "menuitemcheckbox";
    label: string;
    isChecked: boolean;
    onChange: (isChecked: boolean) => void;
}

export interface MenuLinkItem extends ControlProps {
    role: "link";
    label: string;
    href: string;
    onClick?: () => void;
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

    const [expanded, setExpanded] = React.useState(false);

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

    const onKeydown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown" && !expanded) {
            setExpanded(true);
        }
    }

    const classes = classList("common-menu-dropdown", className);
    const menuId = id + "-menu";

    const menuGroups = getGroups(items);

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
            onKeydown={onKeydown}
        />
        {expanded &&
            <ul role="menu"
                className="common-menu-dropdown-pane"
                tabIndex={0}
                id={menuId}
                aria-labelledby={id}
            >
                <FocusTrap
                    arrowKeyNavigation={true}
                    onEscape={onSubpaneEscape}
                    includeOutsideTabOrder={true}
                    dontTrapFocus={true}
                    dontRestoreFocus={true}
                    focusFirstItem={true}
                >
                    {menuGroups.map((group, groupIndex) =>
                        <React.Fragment key={groupIndex}>
                            <li role="none">
                                <ul role="group">
                                    {group.items.map(
                                        (item, itemIndex) => {
                                            const key = `${groupIndex}-${itemIndex}`;
                                            if (item.role === "menuitem") {
                                                return (
                                                    <MenuDropdownItemImpl
                                                        {...item}
                                                        key={key}
                                                        onClick={() => {
                                                            setExpanded(false);
                                                            item.onClick?.();
                                                        }}
                                                    />
                                                )
                                            }
                                            else if (item.role === "link") {
                                                return (
                                                    <MenuLinkItemImpl
                                                        {...item}
                                                        key={key}
                                                        onClick={() => {
                                                            setExpanded(false);
                                                            item.onClick?.();
                                                        }}
                                                    />
                                                )
                                            }
                                            else {
                                                return (
                                                    <MenuCheckboxItemImpl
                                                        {...item}
                                                        key={key}
                                                        onChange={newValue => {
                                                            setExpanded(false);
                                                            item.onChange?.(newValue);
                                                        }}
                                                    />
                                                );
                                            }
                                        }
                                    )}
                                </ul>
                            </li>
                            {groupIndex < menuGroups.length - 1 &&
                                <li
                                    role="separator"
                                    className={classList("common-menu-dropdown-separator", group.className)}
                                />
                            }
                        </React.Fragment>
                    )}
                </FocusTrap>
            </ul>
        }
    </div>
}

export const MenuDropdownItemImpl = (props: MenuDropdownItem) => {
    const inflated = inflateButtonProps(props);

    return (
        <li
            {...inflated}
            className={classList("common-menu-dropdown-item", inflated.className)}
            role="menuitem"
            tabIndex={-1}
        >
            <ButtonBody {...props} />
        </li>
    )
}

export const MenuCheckboxItemImpl = (props: MenuCheckboxItem) => {
    const {
        label,
        isChecked,
        onChange,
        id,
        className,
        ariaLabel,
        ariaHidden,
        ariaDescribedBy,
    } = props;

    return (
        <li
            role="menuitemcheckbox"
            aria-checked={isChecked}
            tabIndex={-1}
            className={classList("common-menu-dropdown-item", "common-menu-dropdown-checkbox-item", className)}
            aria-label={ariaLabel}
            aria-hidden={ariaHidden}
            aria-describedby={ariaDescribedBy}
            onClick={() => onChange(!isChecked)}
            onKeyDown={fireClickOnEnter}
            id={id}
        >
            <CheckboxIcon
                isChecked={isChecked}
            />
            <span>
                {label}
            </span>
        </li>
    );
}

export const MenuLinkItemImpl = (props: MenuLinkItem & { onClick?: () => void }) => {
    const {
        href,
        label,
        id,
        className,
        ariaLabel,
        ariaHidden,
        ariaDescribedBy,
        onClick
    } = props;

    return (
        <a
            role="none"
            className={classList("common-menu-dropdown-item", "common-menu-dropdown-link-item", className)}
            aria-label={ariaLabel}
            aria-hidden={ariaHidden}
            aria-describedby={ariaDescribedBy}
            id={id}
            tabIndex={-1}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClick}
            onKeyDown={fireClickOnEnter}
        >
            {label}
        </a>
    );
}

interface Group {
    items: (MenuDropdownItem | MenuCheckboxItem | MenuLinkItem)[];
    className?: string;
}

function getGroups(items: MenuItem[]): Group[] {
    const groups: Group[] = [];
    let currentGroup: Group = { items: [] };

    for (const item of items) {
        if (item.role === "separator") {
            currentGroup.className = item.className;

            if (currentGroup.items.length > 0) {
                groups.push(currentGroup);
                currentGroup = { items: [] };
            }
        }
        else {
            currentGroup.items.push(item);
        }
    }

    if (currentGroup.items.length > 0) {
        groups.push(currentGroup);
    }

    return groups;
}