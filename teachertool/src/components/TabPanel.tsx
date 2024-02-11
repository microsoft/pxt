import * as React from "react";
import css from "./styling/TabPanel.module.scss";
import { useContext } from "react";
import { classList } from "react-common/components/util";
import { AppStateContext } from "../state/appStateContext";
import { TabName } from "../types";

interface ITabPanelProps extends React.PropsWithChildren<{}> {
    name: TabName;
}

export const TabPanel: React.FC<ITabPanelProps> = ({ children, name }) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const active = teacherTool.activeTab === name;

    return active ? <div className={classList(css.tabpanel, "tt-tabpanel")}>{children}</div> : null;
};
