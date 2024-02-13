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
        <Button {...props} className={classList(css["toolbar-button"], "tt-toolbar-button")} rightIcon={props.icon} />
    );
};

interface ToolbarControlGroupProps extends React.PropsWithChildren<{}> {}

const ToolbarControlGroup: React.FC<ToolbarControlGroupProps> = ({ children }) => {
    return <div className={classList(css["toolbar-control-group"], "tt-toolbar-control-group")}>{children}</div>;
};

interface ToolbarMenuDropdownProps extends MenuDropdownProps {}

const ToolbarMenuDropdown: React.FC<ToolbarMenuDropdownProps> = props => {
    const dropdownLabel = <i className={"fas fa-ellipsis-v"} />;
    return (
        <MenuDropdown
            {...props}
            className={classList(css["toolbar-menu-dropdown"], "tt-toolbar-menu-dropdown")}
            label={dropdownLabel}
        />
    );
};

interface ToolbarToggleProps {
    label: string;
    isChecked: boolean;
    onChange: (checked: boolean) => void;
}

const ToolbarToggle: React.FC<ToolbarToggleProps> = ({ label, isChecked, onChange }) => {
    const [checked, setChecked] = React.useState(isChecked);

    const onClick = () => {
        setChecked(!checked);
        onChange(!checked);
    };

    return (
        <Button
            className={css["toggle-button"]}
            title={label}
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
}

const ToolbarControl: React.FC<ToolbarControlProps> = ({ left, center, right }) => {
    return (
        <div className={classList(css["toolbar"], "tt-toolbar")}>
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
