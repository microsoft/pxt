import * as React from "react";
import { classList, ControlProps } from "../util";
import { Button, ButtonViewProps } from "./Button";
import { FocusList } from "./FocusList";

export interface DropdownItem extends ButtonViewProps {
    id: string;
    role?: "option" | undefined;
}

export interface DropdownProps extends ControlProps {
    id: string;
    selectedId: string;
    items: DropdownItem[];
    onItemSelected: (id: string) => void;
    tabIndex?: number;
}

export const Dropdown = (props: DropdownProps) => {
    const {
        id,
        className,
        ariaHidden,
        ariaLabel,
        role,
        items,
        tabIndex,
        selectedId,
        onItemSelected
    } = props;

    const [ expanded, setExpanded ] = React.useState(false);

    const container = React.useRef<HTMLDivElement | null>();
    const dropdownButton = React.useRef<HTMLButtonElement | null>();
    const focusableItems = React.useRef<{[k: string]: HTMLButtonElement}>({});

    React.useEffect(() => {
        if (expanded && Object.keys(focusableItems.current).length) {
            focusableItems.current[selectedId ?? 0].focus();
        }
    }, [expanded]);

    const onMenuButtonClick = () => {
        setExpanded(!expanded);
    }

    const onBlur = (e: React.FocusEvent) => {
        if (!container.current) return;
        if (expanded && !container.current.contains(e.relatedTarget as HTMLElement)) setExpanded(false);
    }

    const classes = classList("common-dropdown", className);

    const selected = items.find(item => item.id === selectedId) || items[0];
    const onItemFocused = (element: HTMLElement) => {
        if (element.id && items.some(item => item.id === element.id)) onItemSelected(element.id);
    }

    const onKeyDown = (e: React.KeyboardEvent) => {
        const selectedIndex = items.indexOf(selected)

        if (e.key === "ArrowDown") {
            if (expanded) {
                if (selectedIndex < items.length - 1) {
                    onItemSelected(items[selectedIndex + 1].id);
                }
            } else {
                setExpanded(true);
            }
            e.preventDefault();
            e.stopPropagation();
        }
        else if (e.key === "ArrowUp") {
            if (selectedIndex > 0) {
                onItemSelected(items[selectedIndex - 1].id);
                e.preventDefault();
                e.stopPropagation();
            }
        }
        else if (e.key === "Enter") {
            setExpanded(true);
            e.preventDefault();
            e.stopPropagation();
        }
    }

    return <div className={classes} ref={container} onBlur={onBlur}>
        <Button
            {...selected}
            id={id}
            buttonRef={ref => dropdownButton.current = (ref as HTMLButtonElement)}
            tabIndex={tabIndex}
            rightIcon={expanded ? "fas fa-chevron-up" : "fas fa-chevron-down"}
            role={role}
            className={classList("common-dropdown-button", expanded && "expanded", selected.className)}
            onClick={onMenuButtonClick}
            onKeydown={onKeyDown}
            ariaHasPopup="listbox"
            ariaExpanded={expanded}
            ariaLabel={ariaLabel}
            ariaHidden={ariaHidden}
            />
        {expanded &&
            <FocusList role="listbox"
                className="common-menu-dropdown-pane common-dropdown-shadow"
                childTabStopId={selectedId}
                aria-labelledby={id}
                useUpAndDownArrowKeys={true}
                onItemReceivedFocus={onItemFocused}>
                    <ul role="presentation">
                        { items.map(item =>
                            <li key={item.id} role="presentation">
                                <Button
                                    {...item}
                                    buttonRef={ref => focusableItems.current[item.id] = (ref as HTMLButtonElement)}
                                    className={classList("common-dropdown-item", item.className)}
                                    onClick={() => {
                                        setExpanded(false);
                                        onItemSelected(item.id);
                                        dropdownButton.current?.focus();
                                    }}
                                    ariaSelected={item.id === selectedId}
                                    role="option"/>
                            </li>
                        )}
                    </ul>
            </FocusList>
        }
    </div>
}