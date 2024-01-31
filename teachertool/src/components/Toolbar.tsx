import * as React from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/Toolbar.module.scss";

import { classList } from "react-common/components/util";

interface IProps {
    children: React.ReactNode;
    toolbarClass?: string;
    leftClass?: string;
    centerClass?: string;
    rightClass?: string;
}

export const Toolbar: React.FC<IProps> = ({ children, toolbarClass, leftClass, centerClass, rightClass }) => {
    const [left, center, right] = React.Children.toArray(children);
    return (
        <div className={classList(css["toolbar"], toolbarClass)}>
            <div className={classList(css["left"], leftClass)}>{left}</div>
            <div className={classList(css["center"], centerClass)}>{center}</div>
            <div className={classList(css["right"], rightClass)}>{right}</div>
        </div>
    );
};
