import * as React from "react";

export interface TabContentProps {
    className: string;
    icon?: string;
    title?: string;
    children?: React.ReactNode;
}

export function TabContent(props: TabContentProps) {
    return <div>{props.children}</div>
}