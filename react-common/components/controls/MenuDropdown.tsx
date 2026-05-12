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

    const openedByKeyboard = React.useRef(false);

    React.useEffect(() => {
        // Focus the first visible menuitem, menuitemcheckbox or menuitemradio when opened via keyboard.
        if (expanded && container && openedByKeyboard.current) {
            const menu = container.querySelector("[role=menu]");
            if (!menu) {
                return;
            }
            const nodes = menu.querySelectorAll(
                "[role=menuitem], [role=menuitemcheckbox], [role=menuitemradio]"
            )
            for (const node of nodes) {
                const el = node as HTMLElement;
                if (el.offsetParent !== null) {
                    el.focus();
                    break;
                }
            }
        }
    }, [expanded])

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

    const onMenuButtonClick = (e: React.MouseEvent) => {
        openedByKeyboard.current = e.detail === 0;
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
            openedByKeyboard.current = true;
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
            onClick={null}
            onClickEvent={onMenuButtonClick}
            ariaHasPopup="true"
            ariaExpanded={expanded}
            ariaControls={expanded ? menuId : undefined}
            ariaLabel={ariaLabel}
            ariaHidden={ariaHidden}
            disabled={disabled}
            onKeydown={onKeydown}
        />
        {expanded &&
            <FocusTrap
                role="menu"
                className="common-menu-dropdown-pane"
                id={menuId}
                arrowKeyNavigation={true}
                onEscape={onSubpaneEscape}
                includeOutsideTabOrder={true}
                dontTrapFocus={true}
                dontRestoreFocus={true}
                focusFirstItem={false}
                ariaLabelledby={id}
                tagName="ul"
            >
                {menuGroups.map((group, groupIndex) =>
                    <React.Fragment key={groupIndex}>
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
                        {groupIndex < menuGroups.length - 1 &&
                            <li
                                role="separator"
                                className={classList("common-menu-dropdown-separator", group.className)}
                            />
                        }
                    </React.Fragment>
                )}
            </FocusTrap>
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
            tabIndex={-1}
            className={classList("common-menu-dropdown-item", "common-menu-dropdown-checkbox-item", className)}
            aria-label={ariaLabel}
            aria-hidden={ariaHidden}
            aria-describedby={ariaDescribedBy}
            aria-checked={isChecked ? "true" : "false"}
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
        <li role="none">
            <a
                role="menuitem"
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
        </li>
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