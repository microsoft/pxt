import * as React from "react";
import css from "./styling/ProjectWorkspace.module.scss";
import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { getSafeProjectName } from "../state/helpers";
import { Toolbar } from "./Toolbar";
import { ShareLinkInput } from "./ShareLinkInput";
import { MakeCodeFrame } from "./MakecodeFrame";
import { CatalogOverlay } from "./CatalogOverlay";
import { Strings, Ticks } from "../constants";
import { setRunOnLoad } from "../transforms/setRunOnLoad";

const ProjectName: React.FC = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const projectName = getSafeProjectName(teacherTool);
    return projectName ? <div className={css.projectName}>{projectName}</div> : null;
};

const ProjectToolbar: React.FC = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const { runOnLoad } = teacherTool;

    const onRunOnLoadToggled = (checked: boolean) => {
        pxt.tickEvent(Ticks.RunOnLoad, { checked: checked ? "true" : "false" });
        setRunOnLoad(checked);
    };

    return (
        <Toolbar.ControlGroup>
            <Toolbar.Toggle
                label={Strings.RunOnLoad}
                title={Strings.RunOnLoadDescription}
                isChecked={runOnLoad}
                onToggle={onRunOnLoadToggled}
            />
        </Toolbar.ControlGroup>
    );
};

export const ProjectWorkspace: React.FC = () => {
    return (
        <div className={css.panel}>
            <CatalogOverlay />
            <Toolbar left={<ProjectName />} right={<ProjectToolbar />} />
            <ShareLinkInput />
            <MakeCodeFrame />
        </div>
    );
};
