import * as React from "react";

import { TabContentProps } from "./TabContent";

interface TabPaneProps {
    id?: string;
    className?: string;
    children?: any;
    activeTabName?: string;
}

export function TabPane(props: TabPaneProps) {
    const { id, children, className } = props;
    const [ activeTab, setActiveTab ] = React.useState(props.activeTabName);
    const childArray = Array.isArray(children) ? children.filter((el: any) => !!el) : [children];

    React.useEffect(() => {
        if (!childArray.some((el: any) => el.props.name === activeTab)) {
            setActiveTab(childArray[0].props.name)
        }
    }, [children])

    return <div id={id} className={`tab-container ${className || ""}`}>
        {childArray.length > 1 && <div className="tab-navigation">
            {childArray.map(el => {
                const { name, icon, title, onSelected } = el.props as TabContentProps;
                const tabClickHandler = () => {
                    if (onSelected) onSelected();
                    setActiveTab(name);
                }
                return <div key={name} className={`tab-icon ${name} ${name == activeTab ? "active" : ""}`} onClick={tabClickHandler}>
                    <i className={`ui icon ${icon}`} />
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