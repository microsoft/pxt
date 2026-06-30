import * as React from "react";

import { ContainerProps, classList, getFocusableDescendants, findNextFocusableElement } from "../util";
import { ButtonBody, ButtonViewProps, inflateButtonViewProps } from "./Button";

export interface TreeProps extends ContainerProps {
    role?: "tree" | "group";
    title?: string;
    ariaLabelledby?: string;
    initialSelectedId?: string;
}

export interface TreeItemProps extends React.PropsWithChildren<ButtonViewProps> {
    role?: "treeitem";
    initiallyExpanded?: boolean;
    id: string;

    onClick?: () => void;
}

export interface TreeItemBodyProps extends ContainerProps {
}

const handleKeydown = (setSelected: (id: string) => void): React.KeyboardEventHandler<HTMLDivElement> => {
    return (e: React.KeyboardEvent<HTMLDivElement>) => {
        const root = getParentWithRole(e.currentTarget, "tree");
        const focusable = getFocusableDescendants(root as HTMLElement);

        const focusElement = (el: HTMLElement) => {
            if (el) {
                el.focus();
                setSelected(el.getAttribute("id"));
            }
        }

        switch (e.key) {
            case "Enter":
            case " ":
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.click();
                break;
            case "ArrowRight":
                e.preventDefault();
                e.stopPropagation();
                if (e.currentTarget.getAttribute("aria-expanded") === "false") {
                    e.currentTarget.click();
                }
                else if (e.currentTarget.getAttribute("aria-expanded") === "true") {
                    const group = e.currentTarget.querySelector('[role="group"]');
                    if (group) {
                        const firstChild = group.querySelector('[role="treeitem"]');
                        if (firstChild) {
                            focusElement(firstChild as HTMLElement);
                        }
                    }
                }
                break;
            case "ArrowLeft":
                e.preventDefault();
                e.stopPropagation();
                if (e.currentTarget.getAttribute("aria-expanded") === "true") {
                    e.currentTarget.click();
                }
                else {
                    focusElement(getParentWithRole(e.currentTarget, "treeitem") as HTMLElement);
                }
                break;
            case "ArrowDown":
                e.preventDefault();
                e.stopPropagation();
                const index = focusable.indexOf(e.currentTarget);
                const next = findNextFocusableElement(focusable as HTMLElement[], index, index + 1, true, el => el.getAttribute("role") === "treeitem", false);

                focusElement(next);
                break;
            case "ArrowUp":
                e.preventDefault();
                e.stopPropagation();
                const indexUp = focusable.indexOf(e.currentTarget);
                const prev = findNextFocusableElement(focusable as HTMLElement[], indexUp, indexUp - 1, false, el => el.getAttribute("role") === "treeitem", false);
                focusElement(prev);
                break;
            case "Home":
                e.preventDefault();
                e.stopPropagation();
                const first = findNextFocusableElement(focusable as HTMLElement[], 0, 0, true, el => el.getAttribute("role") === "treeitem", false);
                focusElement(first);
                break;
            case "End":
                e.preventDefault();
                e.stopPropagation();
                const last = findNextFocusableElement(focusable as HTMLElement[], focusable.length - 1, focusable.length - 1, false, el => el.getAttribute("role") === "treeitem", false);
                focusElement(last);
                break;
        }
    }
}


const selectedContext = React.createContext<string | undefined>(undefined);
const dispatchContext = React.createContext<React.Dispatch<string> | undefined>(undefined);

const useSelectedId = () => {
    return React.useContext(selectedContext);
}

const useDispatch = () => {
    return React.useContext(dispatchContext);
}

const TreeProvider = ({ children, initialSelectedId }: React.PropsWithChildren<{initialSelectedId?: string}>) => {
    const [state, dispatch] = React.useReducer((state: string | undefined, action: string) => {
        return action;
    }, initialSelectedId);

    return (
        <selectedContext.Provider value={state}>
            <dispatchContext.Provider value={dispatch}>
                {children}
            </dispatchContext.Provider>
        </selectedContext.Provider>
    );
}

function getParentWithRole(element: HTMLElement, role: string): HTMLElement | null {
    let parent: HTMLElement | null = element.parentElement;
    while (parent) {
        if (parent.getAttribute("role") === role) {
            return parent;
        }
        parent = parent.parentElement;
    }
    return null;
}

export const Tree = (props: TreeProps) => {
    const {
        children,
        id,
        className,
        ariaLabel,
        ariaLabelledby,
        ariaHidden,
        ariaDescribedBy,
        role,
        title,
        initialSelectedId
    } = props;

    return (
        <TreeProvider initialSelectedId={initialSelectedId}>
            <div
                className={classList("common-tree", className)}
                id={id}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledby}
                aria-hidden={ariaHidden}
                aria-describedby={ariaDescribedBy}
                role={role || "tree"}
                title={title}
            >
                {children}
            </div>
        </TreeProvider>
    );
};

export const TreeItem = (props: TreeItemProps) => {
    const {
        children,
        initiallyExpanded,
        onClick,
        label,
        labelClassName,
        rightIcon,
        title
    } = props;

    const [expanded, setExpanded] = React.useState(initiallyExpanded);
    const hasSubtree = React.Children.count(children) >= 1;
    const selectedId = useSelectedId();
    const dispatch = useDispatch();

    const onTreeItemClick = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (hasSubtree) {
            setExpanded(!expanded);
        }
        if (onClick) {
            onClick();
        }
        dispatch(props.id);
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
    }, [hasSubtree, expanded, onClick, props.id, dispatch]);

    const buttonViewProps = inflateButtonViewProps(props);
    const isSelected = selectedId === props.id;

    return (
        <div
            {...buttonViewProps}
            className={classList("common-treeitem-container", props.className, isSelected && "selected")}
            role="treeitem"
            onClick={onTreeItemClick}
            tabIndex={isSelected ? 0 : -1}
            onKeyDown={handleKeydown(dispatch)}
            aria-expanded={hasSubtree ? expanded : undefined}
        >
            <div className={classList("common-treeitem", hasSubtree && "has-subtree")}>
                <ButtonBody
                    label={label}
                    title={title}
                    labelClassName={labelClassName}
                    rightIcon={rightIcon}
                    leftIcon={hasSubtree ? (expanded ? "fas fa-chevron-down" : "fas fa-chevron-right") : undefined}
                />
            </div>
            {hasSubtree &&
                <div style={{ display: expanded ? undefined : "none" }} role="group" className="common-tree-subtree">
                    {children}
                </div>
            }
        </div>
    );
}