import * as React from "react";

import { TabContentProps } from "./TabContent";

interface TabPaneProps {
    id?: string;
    className?: string;
    children?: any;
    activeTabName?: string;
}

interface TabPaneState {
    activeTabName: string;
}

export class TabPane extends React.Component<TabPaneProps, TabPaneState> {
    constructor(props: TabPaneProps) {
        super(props);

        this.state = { activeTabName: props.activeTabName || props.children?.[0]?.props?.className };
    }

    protected getTabClickHandler = (name: string) => {
        return () => this.setState({ activeTabName: name });
    }

    render() {
        let { id, children, className } = this.props;
        const { activeTabName } = this.state;

        children = children.filter((el: any) => !!el);

        return <div id={id} className={`tab-container ${className || ""}`}>
            {Array.isArray(children) && <div className="tab-navigation">
                {children.map(el => {
                    const { className, icon, title } = el.props as TabContentProps;
                    return <div key={className} className={`tab-element ${className == activeTabName ? "active" : ""}`} onClick={this.getTabClickHandler(className)}>
                        <i className={`ui icon ${icon}`} />
                        <span>{title}</span>
                    </div>
                })}
            </div>}
            {Array.isArray(children)
                ? children.map((el: any, i: number) => {
                    const { className } = el.props as TabContentProps;
                    return <div key={`tab-content-${i}`} className={`tab-content ${className} ${className !== activeTabName ? "hidden" : ""}`}>
                        {el}
                    </div>
                })
                : children
            }
        </div>
    }
}