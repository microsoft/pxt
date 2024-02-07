import * as React from "react";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/TabGroup.module.scss";

import { useContext } from "react";
import { classList } from "react-common/components/util";
import { Button } from "react-common/components/controls/Button";
import { AppStateContext } from "../state/appStateContext";
import { TabName } from "../types";
import { setActiveTab } from "../transforms/setActiveTab";

interface ITabProps extends React.PropsWithChildren<{}> {
    name: TabName;
    disabled?: boolean;
}

export const TabButton: React.FC<ITabProps> = ({ children, name, disabled }) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const onClick = () => {
        setActiveTab(name);
    };

    const active = teacherTool.activeTab === name;
    const classes = classList("tt-tabgroup-tab", active ? "tt-tabgroup-tab-active" : undefined);

    return (
        <Button className={classes} title={name} onClick={onClick} disabled={disabled}>
            {children}
        </Button>
    );
};

interface ITabGroupProps extends React.PropsWithChildren<{}> {}

export const TabGroup: React.FC<ITabGroupProps> = ({ children }) => {
    return <div className={classList(css.tabgroup, "tt-tabgroup")}>{children}</div>;
};
