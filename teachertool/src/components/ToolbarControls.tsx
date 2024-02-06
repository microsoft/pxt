import * as React from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/ToolbarControls.module.scss";

import { classList } from "react-common/components/util";
import { Button, ButtonProps } from "react-common/components/controls/Button";
import { MenuDropdown, MenuDropdownProps } from "react-common/components/controls/MenuDropdown";

export interface ToolbarButtonProps extends ButtonProps {
    icon: string;
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = props => {
    return (
        <Button {...props} className={classList(css["toolbar-button"], "tt-toolbar-button")} rightIcon={props.icon} />
    );
};

export interface ToolbarControlGroupProps extends React.PropsWithChildren<{}> {}

export const ToolbarControlGroup: React.FC<ToolbarControlGroupProps> = ({ children }) => {
    return <div className={classList(css["toolbar-control-group"], "tt-toolbar-control-group")}>{children}</div>;
};

export interface ToolbarMenuDropdownProps extends MenuDropdownProps {}

export const ToolbarMenuDropdown: React.FC<ToolbarMenuDropdownProps> = props => {
    const dropdownLabel = <i className={"fas fa-ellipsis-v"} />;
    return (
        <MenuDropdown
            {...props}
            className={classList(css["toolbar-menu-dropdown"], "tt-toolbar-menu-dropdown")}
            label={dropdownLabel}
        />
    );
};
