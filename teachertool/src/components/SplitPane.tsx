import * as React from "react";
import css from "./styling/SplitPane.module.scss";
import { classList } from "react-common/components/util";

interface IProps {
    className?: string;
    split: "horizontal" | "vertical";
    defaultSize: number | string;
    primary: "left" | "right";
    children: React.ReactNode;
}

export const SplitPane: React.FC<IProps> = ({ className, split, children }) => {
    const [left, right] = React.Children.toArray(children);

    return (
        <div className={classList(css[`split-pane-${split}`], className)}>
            <div className={css[`left-${split}`]}>{left}</div>
            <div className={css[`splitter-${split}`]}>
                <div className={css[`splitter-${split}-inner`]} />
            </div>
            <div className={css[`right-${split}`]}>{right}</div>
        </div>
    );
};
