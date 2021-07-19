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
    protected containerRef: HTMLDivElement;
    constructor(props: TabPaneProps) {
        super(props);

        this.state = { activeTabName: props.activeTabName || props.children?.[0]?.props?.name };
    }

    protected handleContainerRef = (c: HTMLDivElement) => {
        this.containerRef = c;
        if (c && typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(() => {
                const scrollVisible = c.scrollHeight > c.clientHeight;
                if (scrollVisible)
                    this.containerRef.classList.remove("invisibleScrollbar");
                else
                    this.containerRef.classList.add("invisibleScrollbar");
            })
            observer.observe(c);
        }
    }

    protected getTabClickHandler = (name: string) => {
        return () => this.setState({ activeTabName: name });
    }

    render() {
        const { id, children, className } = this.props;
        const { activeTabName } = this.state;

        return <div id={id} className={`tab-container ${className || ""}`} ref={this.handleContainerRef}>
            {Array.isArray(children) && <div className="tab-navigation">
                {children.map(el => {
                    const { name, icon, title } = el.props as TabContentProps;
                    return <div key={name} className={`tab-element ${name == activeTabName ? "active" : ""}`} onClick={this.getTabClickHandler(name)}>
                        <i className={`ui icon ${icon}`} />
                        <span>{title}</span>
                    </div>
                })}
            </div>}
            {Array.isArray(children)
                ? children.map((el: any) => {
                    const { name } = el.props as TabContentProps;
                    return <div className={`tab-content ${name !== activeTabName ? "hidden" : ""}`}>
                        {el}
                    </div>
                })
                : children
            }
        </div>
    }
}