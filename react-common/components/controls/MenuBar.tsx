import * as React from "react";
import { classList, ContainerProps } from "../util";
import { FocusList } from "./FocusList";

export interface MenuBarProps extends ContainerProps {
}

export const MenuBar = (props: MenuBarProps) =>
    <FocusList {...props}
        role="menubar"
        className={classList("common-menubar", props.className)} />