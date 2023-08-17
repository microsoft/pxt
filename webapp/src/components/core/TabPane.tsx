import * as React from "react";

import { fireClickOnEnter } from "../../util";
import { TabContentProps } from "./TabContent";

interface TabPaneProps {
    id?: string;
    className?: string;
    style?: any;
    children?: any;
    activeTabName?: string;
}

export function TabPane(props: TabPaneProps) {
    const { id, children, className, style, activeTabName } = props;
    const childArray = (Array.isArray(children) ? children : [children]).filter((el: any) => !!el);
    if (!childArray || childArray.length == 0) return <div />;

    const tabsToShow = childArray.filter(el => !(el.props as TabContentProps).disabled);

    const [ activeTab, setActiveTab ] = React.useState(activeTabName);

    const selectTab = (tabProps: TabContentProps) => {
        const { name, onSelected } = tabProps as TabContentProps;
        if (onSelected) onSelected();
        setActiveTab(name);
    }

    React.useEffect(() => {
        if (!childArray.some((el: any) => el.props.name === activeTab)) {
            selectTab(childArray[0].props);
        }
    }, [children])

    React.useEffect(() => {
        const tab = childArray.find((el: any) => el.props.name === activeTabName) || childArray[0];
        selectTab(tab.props);
    }, [activeTabName])

    return <div id={id} className={`tab-container ${className || ""}`} style={style}>
        {tabsToShow.length > 1 && <div className="tab-navigation">
            {tabsToShow.map(el => {
                const { name, icon, title, ariaLabel, showBadge } = el.props as TabContentProps;
                const tabClickHandler = () => selectTab(el.props);

                return <div key={name} className={`tab-icon ${name} ${name == activeTab ? "active" : ""}`}
                    aria-label={ariaLabel} tabIndex={0} onClick={tabClickHandler} onKeyDown={fireClickOnEnter}>
                    {showBadge && <div className="tab-badge" />}
                    <i className={icon} />
                    <span>{title}</span>
                </div>
            })}
        </div>}
        {childArray.map((el: any, i: number) => {
            const { name } = el.props as TabContentProps;
            return <div key={`tab-content-${i}`} className={`tab-content ${name} ${name !== activeTab ? "hidden" : ""}`}>
                {el}
            </div>
        })}
    </div>
}