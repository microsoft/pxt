import * as React from "react";
import css from "./styling/ProjectWorkspace.module.scss";
import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { getSafeProjectName } from "../state/helpers";
import { Toolbar } from "./Toolbar";
import { ShareLinkInput } from "./ShareLinkInput";
import { MakeCodeFrame } from "./MakecodeFrame";
import { CatalogOverlay } from "./CatalogOverlay";

const ProjectName: React.FC = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const projectName = getSafeProjectName(teacherTool);
    return projectName ? <div className={css.projectName}>{projectName}</div> : null;
};

export const ProjectWorkspace: React.FC = () => {
    return (
        <div className={css.panel}>
            <CatalogOverlay />
            <Toolbar center={<ProjectName />} />
            <ShareLinkInput />
            <MakeCodeFrame />
        </div>
    );
};
