import * as React from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/ProjectWorkspace.module.scss";

import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { getSafeProjectName } from "../state/helpers";
import { Toolbar } from "./Toolbar";
import { ShareLinkInput } from "./ShareLinkInput";
import { MakeCodeFrame } from "./MakecodeFrame";

const ProjectName: React.FC = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const projectName = getSafeProjectName(teacherTool);
    return projectName ? <div className={css.projectName}>{projectName}</div> : null;
};

export const ProjectWorkspace: React.FC = () => {
    return (
        <div className={css.panel}>
            <Toolbar center={<ProjectName />} />
            <ShareLinkInput />
            <MakeCodeFrame />
        </div>
    );
};
