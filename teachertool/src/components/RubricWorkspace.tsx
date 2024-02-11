import * as React from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/RubricWorkspace.module.scss";

import { useContext } from "react";
import { AppStateContext, stateAndDispatch } from "../state/appStateContext";
import { Toolbar } from "./Toolbar";
import { TabGroup, TabButton } from "./TabGroup";
import { TabPanel } from "./TabPanel";
import { HomeScreen } from "./HomeScreen";
import { EvalResultDisplay } from "./EvalResultDisplay";
import { ActiveRubricDisplay } from "./ActiveRubricDisplay";
import { MenuItem } from "react-common/components/controls/MenuDropdown";
import { TabName } from "../types";
import { runEvaluateAsync } from "../transforms/runEvaluateAsync";
import { writeRubricToFile } from "../services/fileSystemService";
import { showModal } from "../transforms/showModal";
import { isProjectLoaded } from "../state/helpers";
import { setAutorun } from "../transforms/setAutorun";

function handleImportRubricClicked() {
    pxt.tickEvent("teachertool.importrubric");
    showModal("import-rubric");
}

function handleExportRubricClicked() {
    pxt.tickEvent("teachertool.exportrubric");
    const { state: teacherTool } = stateAndDispatch();
    writeRubricToFile(teacherTool.rubric);
}

async function handleEvaluateClickedAsync() {
    pxt.tickEvent("teachertool.evaluate");
    await runEvaluateAsync(true);
}

const WorkspaceTabButtons: React.FC = () => {
    const { state: teacherTool } = useContext(AppStateContext);

    return (
        <TabGroup>
            <TabButton name="home">{lf("Home")}</TabButton>
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
            <TabPanel name="home">
                <HomeScreen />
            </TabPanel>
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
    const items: MenuItem[] = [];
    switch (tab) {
        case "home":
        case "rubric":
            items.push(
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
                }
            );
            break;
        case "results":
            break;
    }
    return items;
}

const WorkspaceToolbarButtons: React.FC = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const { activeTab, autorun } = teacherTool;

    const actionItems = getActionMenuItems(activeTab);

    const onAutorunChange = (checked: boolean) => {
        pxt.tickEvent("teachertool.autorun", { checked: checked ? "true" : "false" });
        setAutorun(checked);
    };

    return (
        <Toolbar.ControlGroup>
            {activeTab === "results" && (
                <Toolbar.Button icon="fas fa-print" title={lf("Print")} onClick={() => console.log("Print")} />
            )}
            {/* Conditional buttons go above this line */}
            <Toolbar.Toggle label={lf("auto-run")} isChecked={autorun} onChange={onAutorunChange} />
            <Toolbar.Button
                icon="fas fa-play"
                title={lf("Evaluate")}
                onClick={handleEvaluateClickedAsync}
                disabled={!isProjectLoaded(teacherTool)}
            />
            <Toolbar.MenuDropdown title={lf("More Actions")} items={actionItems} disabled={!actionItems.length} />
        </Toolbar.ControlGroup>
    );
};

export const RubricWorkspace: React.FC = () => {
    return (
        <div className={css.panel}>
            <Toolbar left={<WorkspaceTabButtons />} right={<WorkspaceToolbarButtons />} />
            <WorkspaceTabPanels />
        </div>
    );
};
