import * as React from "react";
import { classList, ControlProps } from "../util";
import { Button, ButtonViewProps } from "./Button";
import { DropdownProps } from "./Dropdown";
import { FocusList } from "./FocusList";
import { Modal } from "./Modal";

interface DropdownModalProps extends DropdownProps {
    onClose: () => void;
}

export const DropdownModal = (props: DropdownModalProps) => {
    const {
        className,
        ariaLabel,
        items,
        selectedId,
        onItemSelected,
        onClose
    } = props;

    const focusableItems = React.useRef<{[k: string]: HTMLButtonElement}>({});

    React.useEffect(() => {
        if (Object.keys(focusableItems.current).length) {
            focusableItems.current[selectedId ?? 0].focus();
        }
    }, [selectedId]);


    return (
        <Modal
            className={classList("common-dropdown-modal", className)}
            title={ariaLabel}
            hideTitle={true}
            onClose={onClose}
            hideDismissButton={true}
        >
            <FocusList
                role="listbox"
                className="common-menu-dropdown-pane common-dropdown-shadow"
                childTabStopId={selectedId}
                useUpAndDownArrowKeys={true}
                onClose={onClose}
            >
                    <ul role="presentation">
                        { items.map(item =>
                            <li key={item.id} role="presentation">
                                <Button
                                    {...item}
                                    buttonRef={ref => focusableItems.current[item.id] = (ref as HTMLButtonElement)}
                                    className={classList("common-dropdown-item", item.className)}
                                    onClick={() => {
                                        onItemSelected(item.id);
                                        onClose();
                                    }}
                                    ariaSelected={item.id === selectedId}
                                    leftIcon={classList("fas fa-check", selectedId !== item.id && "transparent")}
                                    role="option"/>
                            </li>
                        )}
                    </ul>
            </FocusList>
        </Modal>
    )
}