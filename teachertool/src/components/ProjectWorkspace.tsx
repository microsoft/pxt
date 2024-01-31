import * as React from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/ProjectWorkspace.module.scss";

import { Toolbar } from "./Toolbar";
import { ShareLinkInput } from "./ShareLinkInput";
import { MakeCodeFrame } from "./MakecodeFrame";

interface IProps {}

export const ProjectWorkspace: React.FC<IProps> = () => {
    return (
        <div className={css.panel}>
            <Toolbar>
                {/* Left */}
                <></>
                {/* Center */}
                <></>
                {/* Right */}
                <></>
            </Toolbar>
            <ShareLinkInput />
            <MakeCodeFrame />
        </div>
    );
};
