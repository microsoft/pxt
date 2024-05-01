import * as React from "react";
import css from "./styling/RubricWorkspace.module.scss";
import { useContext, useRef } from "react";
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
import { PrintButton } from "./PrintButton";
import { ImportRubricOptions } from "../types/modalOptions";

function handleImportRubricClicked() {
    pxt.tickEvent(Ticks.ImportChecklist);
    showModal({ modal: "import-rubric" } as ImportRubricOptions);
}

function handleExportRubricClicked() {
    pxt.tickEvent(Ticks.ExportChecklist);
    const { state: teacherTool } = stateAndDispatch();
    writeRubricToFile(teacherTool.rubric);
}

async function handleNewRubricClickedAsync() {
    pxt.tickEvent(Ticks.NewChecklist);
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
            <TabButton name="home">{Strings.Home}</TabButton>
            <TabButton name="rubric">{Strings.Checklist}</TabButton>
            <TabButton name="results" disabled={!isProjectLoaded(teacherTool)}>
                {lf("Results")}
            </TabButton>
        </TabGroup>
    );
};

interface WorkspaceTabPanelsProps {
    resultsRef: React.RefObject<HTMLDivElement>;
}

const WorkspaceTabPanels: React.FC<WorkspaceTabPanelsProps> = ({ resultsRef }) => {
    return (
        <>
            <TabPanel name="home">
                <HomeScreen />
            </TabPanel>
            <TabPanel name="rubric">
                <ActiveRubricDisplay />
            </TabPanel>
            <TabPanel name="results">
                <EvalResultDisplay resultsRef={resultsRef} />
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
                    title: Strings.NewChecklist,
                    label: Strings.NewChecklist,
                    ariaLabel: Strings.NewChecklist,
                    onClick: handleNewRubricClickedAsync,
                },
                {
                    title: Strings.ImportChecklist,
                    label: Strings.ImportChecklist,
                    ariaLabel: Strings.ImportChecklist,
                    onClick: handleImportRubricClicked,
                },
                {
                    title: Strings.ExportChecklist,
                    label: Strings.ExportChecklist,
                    ariaLabel: Strings.ExportChecklist,
                    onClick: handleExportRubricClicked,
                }
            );
            break;
        case "results":
            break;
    }
    return items;
}

interface WorkspaceToolbarButtonsProps {
    resultsRef: React.RefObject<HTMLDivElement>;
}

const WorkspaceToolbarButtons: React.FC<WorkspaceToolbarButtonsProps> = ({ resultsRef }) => {
    const { state: teacherTool } = useContext(AppStateContext);
    const { activeTab, autorun } = teacherTool;

    const actionItems = getActionMenuItems(activeTab);

    const onAutorunChange = (checked: boolean) => {
        pxt.tickEvent(Ticks.Autorun, { checked: checked ? "true" : "false" });
        setAutorun(checked);
    };

    return (
        <Toolbar.ControlGroup>
            {activeTab === "results" && <PrintButton printRef={resultsRef} />}
            {/* Conditional buttons go above this line */}
            <Toolbar.Toggle
                label={Strings.AutoRun}
                title={Strings.AutoRunDescription}
                isChecked={autorun}
                onChange={onAutorunChange}
            />
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
    const resultsRef = useRef<HTMLDivElement>(null);
    return (
        <div className={css.panel}>
            <Toolbar left={<WorkspaceTabButtons />} right={<WorkspaceToolbarButtons resultsRef={resultsRef} />} />
            <WorkspaceTabPanels resultsRef={resultsRef} />
        </div>
    );
};
