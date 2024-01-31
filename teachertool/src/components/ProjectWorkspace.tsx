import * as React from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/ProjectWorkspace.module.scss";

import { Toolbar } from "./Toolbar";
import { AddressBar } from "./AddressBar";
import { MakeCodeFrame } from "./MakecodeFrame";
import { classes } from "../utils";

interface IProps {}

export const ProjectWorkspace: React.FC<IProps> = () => {
    return (
        <div className={classes(css, "panel", "h-full", "w-full", "flex", "flex-col")}>
            <Toolbar toolbarClass={css["grow-1"]}>
                {/* Left */}
                <></>
                {/* Center */}
                <></>
                {/* Right */}
                <></>
            </Toolbar>
            <AddressBar className={css["grow-1"]} />
            <MakeCodeFrame />
        </div>
    );
};
