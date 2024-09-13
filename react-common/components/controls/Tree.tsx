import * as React from "react";

import { ContainerProps, classList } from "../util";
import { FocusList } from "./FocusList";

export interface TreeProps extends ContainerProps {
    role?: "tree" | "group";
}

export interface TreeItemProps extends ContainerProps {
    role?: "treeitem";
    onClick?: () => void;
    initiallyExpanded?: boolean;
    title?: string;
}

export interface TreeItemBodyProps extends ContainerProps {
}

export const Tree = (props: TreeProps) => {
    const {
        children,
        id,
        className,
        ariaLabel,
        ariaHidden,
        ariaDescribedBy,
        role,
    } = props;

    if (!role || role === "tree") {
        return (
            <FocusList
                className={classList("common-tree", className)}
                id={id}
                aria-label={ariaLabel}
                aria-hidden={ariaHidden}
                aria-describedby={ariaDescribedBy}
                role={role || "tree"}
            >
                {children}
            </FocusList>
        )
    }

    return (
        <div
            className={classList("common-tree", "subtree", className)}
            id={id}
            aria-label={ariaLabel}
            aria-hidden={ariaHidden}
            aria-describedby={ariaDescribedBy}
            role={role || "tree"}
        >
            {children}
        </div>
    )
};

export const TreeItem = (props: TreeItemProps) => {
    const {
        children,
        id,
        className,
        ariaLabel,
        ariaHidden,
        ariaDescribedBy,
        role,
        initiallyExpanded,
        onClick,
        title
    } = props;

    const [expanded, setExpanded] = React.useState(initiallyExpanded);
    const mappedChildren = React.Children.toArray(children);
    const hasSubtree = mappedChildren.length > 1;

    const subtreeContainer = React.useRef<HTMLDivElement>()

    React.useEffect(() => {
        if (!hasSubtree) return;

        if (expanded) {
            const focusable = subtreeContainer.current.querySelectorAll(`[tabindex]:not([tabindex="-1"]),[data-isfocusable]`);
            focusable.forEach(f => f.setAttribute("data-isfocusable", "true"));
        }
        else {
            const focusable = subtreeContainer.current.querySelectorAll(`[tabindex]:not([tabindex="-1"]),[data-isfocusable]`);
            focusable.forEach(f => f.setAttribute("data-isfocusable", "false"));
        }
    }, [expanded, hasSubtree]);

    const onTreeItemClick = React.useCallback(() => {
        if (hasSubtree) {
            setExpanded(!expanded);
        }
        if (onClick) {
            onClick();
        }
    }, [hasSubtree, expanded])

    return (
        <div
            className="common-treeitem-container"
            id={id}
            aria-label={ariaLabel}
            aria-hidden={ariaHidden}
            aria-describedby={ariaDescribedBy}
            role={role || "treeitem"}
            title={title}
        >
            <div className={classList("common-treeitem", className)} onClick={onTreeItemClick}>
                {hasSubtree &&
                    <i
                        className={classList("fas", expanded ? "fa-chevron-down" : "fa-chevron-right")}
                        aria-hidden={true}
                    />
                }
                {mappedChildren[0]}
            </div>
            <div
                ref={subtreeContainer}
                style={{ display: expanded ? undefined : "none" }}
            >
                {hasSubtree ? mappedChildren[1] : undefined}
            </div>
        </div>
    );
}

export const TreeItemBody = (props: TreeItemBodyProps) => {
    const {
        children,
        id,
        className,
        ariaLabel,
        ariaHidden,
        ariaDescribedBy,
        role,
    } = props;

    return (
        <div
            className={classList("common-treeitembody", className)}
            id={id}
            aria-label={ariaLabel}
            aria-hidden={ariaHidden}
            aria-describedby={ariaDescribedBy}
            role={role}
            tabIndex={0}
        >
            {children}
        </div>
    );
}