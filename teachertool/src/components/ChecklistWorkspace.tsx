import * as React from "react";
import css from "./styling/ChecklistWorkspace.module.scss";
import { useRef } from "react";
import { Toolbar } from "./Toolbar";
import { TabGroup, TabButton } from "./TabGroup";
import { TabPanel } from "./TabPanel";
import { HomeScreen } from "./HomeScreen";
import { EvalResultDisplay } from "./EvalResultDisplay";
import { Strings } from "../constants";

const WorkspaceTabButtons: React.FC = () => {
    return (
        <TabGroup>
            <TabButton name="home">{Strings.Home}</TabButton>
            <TabButton name="results">{Strings.Checklist}</TabButton>
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
            <TabPanel name="results">
                <EvalResultDisplay resultsRef={resultsRef} />
            </TabPanel>
        </>
    );
};

export const ChecklistWorkspace: React.FC = () => {
    const resultsRef = useRef<HTMLDivElement>(null);
    return (
        <div className={css.panel}>
            <Toolbar left={<WorkspaceTabButtons />}  />
            <WorkspaceTabPanels resultsRef={resultsRef} />
        </div>
    );
};
