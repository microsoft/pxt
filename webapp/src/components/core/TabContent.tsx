import * as React from "react";

export interface TabContentProps {
    name: string;
    icon?: string;
    title?: string;
    ariaLabel?: string;
    showBadge?: boolean;
    children?: React.ReactNode;
    onSelected?: () => void;
}

export function TabContent(props: TabContentProps) {
    return <div>{props.children}</div>
}