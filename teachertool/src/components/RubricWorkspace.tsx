import * as React from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/RubricWorkspace.module.scss";

import { useContext } from "react";
import { AppStateContext, stateAndDispatch } from "../state/appStateContext";
import { Toolbar } from "./Toolbar";
import { TabGroup, TabButton } from "./TabGroup";
import { TabPanel } from "./TabPanel";
import { EvalResultDisplay } from "./EvalResultDisplay";
import { ActiveRubricDisplay } from "./ActiveRubricDisplay";
import { ToolbarControlGroup, ToolbarButton, ToolbarMenuDropdown } from "./ToolbarControls";
import { MenuItem } from "react-common/components/controls/MenuDropdown";
import { TabName } from "../types";
import { runEvaluateAsync } from "../transforms/runEvaluateAsync";
import { writeRubricToFile } from "../services/fileSystemService";
import { showModal } from "../transforms/showModal";
import { isProjectLoaded } from "../state/helpers";
import { setActiveTab } from "../transforms/setActiveTab";

function handleImportRubricClicked() {
    showModal("import-rubric");
}

function handleExportRubricClicked() {
    const { state: teacherTool } = stateAndDispatch();
    writeRubricToFile(teacherTool.rubric);
}

async function handleEvaluateClickedAsync() {
    setActiveTab("results");
    await runEvaluateAsync();
}

const WorkspaceTabButtons: React.FC = () => {
    const { state: teacherTool } = useContext(AppStateContext);

    return (
        <TabGroup>
            <TabButton name="rubric">{lf("Rubric")}</TabButton>
            <TabButton name="results" disabled={!isProjectLoaded(teacherTool)}>
                {lf("Results")}
            </TabButton>
        </TabGroup>
    );
};

const WorkspaceTabPanels: React.FC = () => {
    return (
        <>
            <TabPanel name="rubric">
                <ActiveRubricDisplay />
            </TabPanel>
            <TabPanel name="results">
                <EvalResultDisplay />
            </TabPanel>
        </>
    );
};

function getActionMenuItems(tab: TabName): MenuItem[] {
    switch (tab) {
        case "rubric":
            return [
                {
                    title: lf("Import Rubric"),
                    label: lf("Import Rubric"),
                    ariaLabel: lf("Import Rubric"),
                    onClick: handleImportRubricClicked,
                },
                {
                    title: lf("Export Rubric"),
                    label: lf("Export Rubric"),
                    ariaLabel: lf("Export Rubric"),
                    onClick: handleExportRubricClicked,
                },
            ];
        case "results":
            return [];
    }
}

const WorkspaceToolbarButtons: React.FC = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const { activeTab } = teacherTool;

    const actionItems = getActionMenuItems(activeTab);

    return (
        <ToolbarControlGroup>
            {activeTab === "results" && (
                <ToolbarButton icon="fas fa-print" title={lf("Print")} onClick={() => console.log("Print")} />
            )}

            <ToolbarButton
                icon="fas fa-play"
                title={lf("Evaluate")}
                onClick={handleEvaluateClickedAsync}
                disabled={!isProjectLoaded(teacherTool)}
            />

            <ToolbarMenuDropdown title={lf("More Actions")} items={actionItems} disabled={!actionItems.length} />
        </ToolbarControlGroup>
    );
};

interface IProps {}

export const RubricWorkspace: React.FC<IProps> = () => {
    return (
        <div className={css.panel}>
            <Toolbar left={<WorkspaceTabButtons />} right={<WorkspaceToolbarButtons />} />
            <WorkspaceTabPanels />
        </div>
    );
};
