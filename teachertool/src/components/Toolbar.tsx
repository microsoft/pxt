import * as React from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/Toolbar.module.scss";

import { classList } from "react-common/components/util";

interface IProps {
    children: React.ReactNode;
}

export const Toolbar: React.FC<IProps> = ({ children }) => {
    const [left, center, right] = React.Children.toArray(children);
    return (
        <div className={classList(css["toolbar"], "tt-toolbar")}>
            <div className={classList(css["left"], "tt-toolbar-left")}>{left}</div>
            <div className={classList(css["center"], "tt-toolbar-center")}>{center}</div>
            <div className={classList(css["right"], "tt-toolbar-right")}>{right}</div>
        </div>
    );
};
