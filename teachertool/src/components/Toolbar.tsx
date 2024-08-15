import * as React from "react";
import css from "./styling/Toolbar.module.scss";
import { classList } from "react-common/components/util";
import { Button, ButtonProps } from "react-common/components/controls/Button";
import { MenuDropdown, MenuDropdownProps } from "react-common/components/controls/MenuDropdown";

interface ToolbarButtonProps extends ButtonProps {
    icon: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = props => {
    return (
        <Button
            {...props}
            className={classList(css["toolbar-button"], "tt-toolbar-button", props.className)}
            rightIcon={props.icon}
        />
    );
};

interface ToolbarControlGroupProps extends React.PropsWithChildren<{}> {
    className?: string;
}

const ToolbarControlGroup: React.FC<ToolbarControlGroupProps> = ({ children, className }) => {
    return (
        <div className={classList(css["toolbar-control-group"], "tt-toolbar-control-group", className)}>{children}</div>
    );
};

interface ToolbarMenuDropdownProps extends MenuDropdownProps {}

const ToolbarMenuDropdown: React.FC<ToolbarMenuDropdownProps> = props => {
    const dropdownLabel = <i className={"fas fa-ellipsis-v"} />;
    return (
        <MenuDropdown
            {...props}
            className={classList(css["toolbar-menu-dropdown"], "tt-toolbar-menu-dropdown", props.className)}
            label={dropdownLabel}
        />
    );
};

interface ToolbarToggleProps {
    label: string;
    title: string;
    isChecked: boolean;
    onChange: (checked: boolean) => void;
    className?: string;
}

const ToolbarToggle: React.FC<ToolbarToggleProps> = ({ label, title, isChecked, onChange, className }) => {
    const [checked, setChecked] = React.useState(isChecked);

    const onClick = () => {
        setChecked(!checked);
        onChange(!checked);
    };

    return (
        <Button
            className={classList(css["toggle-button"], className)}
            title={title}
            label={label}
            ariaLabel={label}
            onClick={onClick}
            rightIcon={checked ? "fas fa-toggle-on" : "fas fa-toggle-off"}
            ariaPressed={checked}
        />
    );
};

interface ToolbarControlProps {
    left?: React.ReactNode;
    center?: React.ReactNode;
    right?: React.ReactNode;
    className?: string;
}

const ToolbarControl: React.FC<ToolbarControlProps> = ({ left, center, right, className }) => {
    return (
        <div className={classList(css["toolbar"], "tt-toolbar", className)}>
            <div className={classList(css["left"], "tt-toolbar-left")}>{left}</div>
            <div className={classList(css["center"], "tt-toolbar-center")}>{center}</div>
            <div className={classList(css["right"], "tt-toolbar-right")}>{right}</div>
        </div>
    );
};

export const Toolbar = Object.assign(ToolbarControl, {
    Button: ToolbarButton,
    ControlGroup: ToolbarControlGroup,
    MenuDropdown: ToolbarMenuDropdown,
    Toggle: ToolbarToggle,
});
