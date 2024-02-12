import * as React from "react";
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
import { Strings, Ticks } from "../constants";
import { resetRubricAsync } from "../transforms/resetRubricAsync";

function handleImportRubricClicked() {
    pxt.tickEvent(Ticks.ImportRubric);
    showModal("import-rubric");
}

function handleExportRubricClicked() {
    pxt.tickEvent(Ticks.ExportRubric);
    const { state: teacherTool } = stateAndDispatch();
    writeRubricToFile(teacherTool.rubric);
}

async function handleNewRubricClickedAsync() {
    pxt.tickEvent(Ticks.NewRubric);
    await resetRubricAsync();
}

async function handleEvaluateClickedAsync() {
    pxt.tickEvent(Ticks.Evaluate);
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
                    title: Strings.NewRubric,
                    label: Strings.NewRubric,
                    ariaLabel: Strings.NewRubric,
                    onClick: handleNewRubricClickedAsync,
                },
                {
                    title: Strings.ImportRubric,
                    label: Strings.ImportRubric,
                    ariaLabel: Strings.ImportRubric,
                    onClick: handleImportRubricClicked,
                },
                {
                    title: Strings.ExportRubric,
                    label: Strings.ExportRubric,
                    ariaLabel: Strings.ExportRubric,
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
        pxt.tickEvent(Ticks.Autorun, { checked: checked ? "true" : "false" });
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
