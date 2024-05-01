import * as React from "react";
import css from "./styling/ChecklistWorkspace.module.scss";
import { useContext, useRef } from "react";
import { AppStateContext, stateAndDispatch } from "../state/appStateContext";
import { Toolbar } from "./Toolbar";
import { TabGroup, TabButton } from "./TabGroup";
import { TabPanel } from "./TabPanel";
import { HomeScreen } from "./HomeScreen";
import { EvalResultDisplay } from "./EvalResultDisplay";
import { ActiveChecklistDisplay } from "./ActiveChecklistDisplay";
import { MenuItem } from "react-common/components/controls/MenuDropdown";
import { TabName } from "../types";
import { runEvaluateAsync } from "../transforms/runEvaluateAsync";
import { writeChecklistToFile } from "../services/fileSystemService";
import { showModal } from "../transforms/showModal";
import { isProjectLoaded } from "../state/helpers";
import { setAutorun } from "../transforms/setAutorun";
import { Strings, Ticks } from "../constants";
import { resetChecklistAsync } from "../transforms/resetChecklistAsync";
import { PrintButton } from "./PrintButton";
import { ImportChecklistOptions } from "../types/modalOptions";

function handleImportChecklistClicked() {
    pxt.tickEvent(Ticks.ImportChecklist);
    showModal({ modal: "import-checklist" } as ImportChecklistOptions);
}

function handleExportChecklistClicked() {
    pxt.tickEvent(Ticks.ExportChecklist);
    const { state: teacherTool } = stateAndDispatch();
    writeChecklistToFile(teacherTool.checklist);
}

async function handleNewChecklistClickedAsync() {
    pxt.tickEvent(Ticks.NewChecklist);
    await resetChecklistAsync();
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
            <TabButton name="checklist">{Strings.Checklist}</TabButton>
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
            <TabPanel name="checklist">
                <ActiveChecklistDisplay />
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
        case "checklist":
            items.push(
                {
                    title: Strings.NewChecklist,
                    label: Strings.NewChecklist,
                    ariaLabel: Strings.NewChecklist,
                    onClick: handleNewChecklistClickedAsync,
                },
                {
                    title: Strings.ImportChecklist,
                    label: Strings.ImportChecklist,
                    ariaLabel: Strings.ImportChecklist,
                    onClick: handleImportChecklistClicked,
                },
                {
                    title: Strings.ExportChecklist,
                    label: Strings.ExportChecklist,
                    ariaLabel: Strings.ExportChecklist,
                    onClick: handleExportChecklistClicked,
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

export const ChecklistWorkspace: React.FC = () => {
    const resultsRef = useRef<HTMLDivElement>(null);
    return (
        <div className={css.panel}>
            <Toolbar left={<WorkspaceTabButtons />} right={<WorkspaceToolbarButtons resultsRef={resultsRef} />} />
            <WorkspaceTabPanels resultsRef={resultsRef} />
        </div>
    );
};
