import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { classList } from "../../../../react-common/components/util";
import { ProjectWhiteboard } from "./ProjectWhiteboard";
import { ProjectBackpack } from "../backpack/index";
import { ProjectToolsHeader } from "./ProjectToolsHeader";
import { ProjectToolsResizeHandle } from "./ProjectToolsResizeHandle";
import { useProjectToolsResize } from "./useProjectToolsResize";
import { useProjectToolsDismiss } from "./useProjectToolsDismiss";
import { BackpackOpenRequest, isBackpackEnabled, subscribeBackpackOpen } from "../../backpack";
import {
    isWhiteboardEnabled,
    PROJECT_TOOLS_COMPACT_QUERY,
    PROJECT_TOOLS_LAUNCHER_ID,
    PROJECT_TOOLS_PANEL_ID,
    ProjectToolTab,
    projectToolPanelId,
    projectToolTabId
} from "../../projectToolsState";

export interface ProjectToolsProps {
    header: pxt.workspace.Header;
    notes?: pxt.workspace.ProjectNotes;
    expanded: boolean;
    pinned: boolean;
    tutorial?: boolean;
    docsUrl?: string;
    docsRequest?: number;
    onExpandedChange: (expanded: boolean) => void;
    onPinnedChange: (pinned: boolean) => void;
    onOpenReference: () => void;
    onSignIn: () => void;
    docsAction?: React.ReactNode;
    children?: React.ReactNode;
}

export function ProjectTools(props: ProjectToolsProps): JSX.Element {
    const whiteboardEnabled = isWhiteboardEnabled();
    const backpackEnabled = isBackpackEnabled();
    const tabNames: ProjectToolTab[] = ["docs"];
    if (whiteboardEnabled) {
        tabNames.push("whiteboard");
    }
    if (backpackEnabled) {
        tabNames.push("backpack");
    }

    const [selectedTab, setTab] = React.useState<ProjectToolTab>("docs");
    const tab = tabNames.includes(selectedTab) ? selectedTab : "docs";
    const [visitedWhiteboard, setVisitedWhiteboard] = React.useState(false);
    const [visitedBackpack, setVisitedBackpack] = React.useState(false);
    const [backpackRequest, setBackpackRequest] = React.useState<BackpackOpenRequest>();

    const [compact, setCompact] = React.useState(() => window.matchMedia(PROJECT_TOOLS_COMPACT_QUERY).matches);
    const [optionsOpen, setOptionsOpen] = React.useState(() => !pxt.BrowserUtils.isTabletSize());

    const root = React.useRef<HTMLDivElement>();
    const launcher = React.useRef<HTMLDivElement>();
    const moreButton = React.useRef<HTMLButtonElement>();
    const focusTabOnOpen = React.useRef(false);
    const openingFromDrag = React.useRef(false);
    const modalOpen = React.useRef(false);
    const onModalOpenChange = React.useCallback((open: boolean) => {
        modalOpen.current = open;
    }, []);

    const panel = React.useRef<HTMLDivElement>();
    const bubbleButtons = React.useRef<HTMLButtonElement[]>([]);
    const rtl = pxt.Util.isUserLanguageRtl();
    const { width, height, resizing, widthHandle, heightHandle } = useProjectToolsResize(panel, props.expanded, compact, rtl);
    const tabIndex = tabNames.indexOf(tab);

    React.useEffect(() => {
        if (!tabNames.includes(selectedTab)) {
            setTab("docs");
            if (props.expanded) {
                bubbleButtons.current[0]?.focus();
            }
        }
        if (!whiteboardEnabled) {
            setVisitedWhiteboard(false);
        }
        if (!backpackEnabled) {
            setVisitedBackpack(false);
        }
    }, [whiteboardEnabled, backpackEnabled, selectedTab]);

    // Blur callbacks can run after Pin changes; read the current state.
    const pinState = React.useRef({ pinned: props.pinned, expanded: props.expanded });
    pinState.current = { pinned: props.pinned, expanded: props.expanded };

    const dismissTools = React.useCallback((explicit = false) => {
        if (!explicit && (modalOpen.current || pinState.current.pinned && pinState.current.expanded)) {
            return;
        }

        // Clicking outside hides the bubbles on small screens, but not on desktop.
        if (explicit || pxt.BrowserUtils.isTabletSize()) {
            setOptionsOpen(false);
        }
        if (pinState.current.expanded) {
            props.onExpandedChange(false);
        }
    }, [props.onExpandedChange]);

    React.useEffect(() => subscribeBackpackOpen(request => {
        if (!backpackEnabled || request.headerId !== props.header.id) {
            return;
        }

        // Opening from a drag must not move keyboard focus.
        openingFromDrag.current = !request.focus;
        focusTabOnOpen.current = request.focus;
        setBackpackRequest(request);
        setVisitedBackpack(true);
        setTab("backpack");
        setOptionsOpen(true);
        props.onExpandedChange(true);
    }), [props.header.id, props.onExpandedChange, backpackEnabled]);

    React.useEffect(() => {
        const query = window.matchMedia(PROJECT_TOOLS_COMPACT_QUERY);
        const tabletQuery = window.matchMedia(`(max-width: ${pxt.BREAKPOINT_TABLET}px)`);

        // Changing orientation must not reveal bubbles the user has hidden.
        const onChange = () => setCompact(query.matches);
        const onTabletChange = () => {
            if (tabletQuery.matches) {
                if (launcher.current?.contains(document.activeElement)) {
                    moreButton.current?.focus();
                }
            }
            setOptionsOpen(!tabletQuery.matches);
        };

        query.addEventListener("change", onChange);
        tabletQuery.addEventListener("change", onTabletChange);

        return () => {
            query.removeEventListener("change", onChange);
            tabletQuery.removeEventListener("change", onTabletChange);
        };
    }, []);

    React.useLayoutEffect(() => {
        // Do not focus the bubbles just because the screen was resized.
        if (!focusTabOnOpen.current || !optionsOpen) {
            return;
        }

        focusTabOnOpen.current = false;
        bubbleButtons.current[tabIndex]?.focus();
    }, [optionsOpen, tabIndex]);

    const onBlur = useProjectToolsDismiss(root, {
        expanded: props.expanded,
        optionsOpen,
        compact,
        docsUrl: props.docsUrl,
        docsRequest: props.docsRequest,
        onDismiss: dismissTools
    });

    React.useEffect(() => {
        if (props.docsUrl) {
            setTab("docs");
            if (props.expanded && (compact || !optionsOpen)) {
                panel.current?.focus();
            }
        }
    }, [props.docsUrl, props.docsRequest]);

    React.useEffect(() => {
        if (props.expanded) {
            if (openingFromDrag.current) {
                return;
            }

            if (!optionsOpen) {
                panel.current?.focus();
            } else {
                bubbleButtons.current[tabIndex]?.focus();
            }
        }
    }, [props.expanded]);

    React.useEffect(() => {
        if (props.expanded && tab === "whiteboard") {
            setVisitedWhiteboard(true);
        }
        if (props.expanded && tab === "backpack") {
            setVisitedBackpack(true);
        }
    }, [props.expanded, tab]);

    const openOptions = () => {
        openingFromDrag.current = false;
        if (optionsOpen) {
            bubbleButtons.current[tabIndex]?.focus();
        } else {
            focusTabOnOpen.current = true;
            setOptionsOpen(true);
        }
    };

    const collapse = () => {
        openingFromDrag.current = false;
        props.onExpandedChange(false);
        if (!optionsOpen) {
            moreButton.current?.focus();
        } else {
            bubbleButtons.current[tabIndex]?.focus();
        }
    };

    const selectTab = (name: ProjectToolTab) => {
        openingFromDrag.current = false;
        if (props.expanded && tab === name) {
            collapse();
        } else {
            setTab(name);
            props.onExpandedChange(true);
        }
    };

    const bubbleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        let next: number;
        switch (event.key) {
            case "ArrowUp":
                if (!compact) {
                    next = index - 1;
                }
                break;
            case "ArrowDown":
                if (!compact) {
                    next = index + 1;
                }
                break;
            case "ArrowLeft":
                if (compact) {
                    next = index + (rtl ? 1 : -1);
                }
                break;
            case "ArrowRight":
                if (compact) {
                    next = index + (rtl ? -1 : 1);
                }
                break;
            case "Home":
                next = 0;
                break;
            case "End":
                next = tabNames.length - 1;
                break;
            default:
                return;
        }

        if (next === undefined) {
            return;
        }

        event.preventDefault();
        next = (next + tabNames.length) % tabNames.length;
        if (!compact) {
            setTab(tabNames[next]);
        }
        bubbleButtons.current[next]?.focus();
    };

    const renderHeader = (title: string, actions?: React.ReactNode): React.ReactNode => (
        <ProjectToolsHeader
            title={title}
            actions={actions}
            pinned={props.pinned}
            onPinnedChange={props.onPinnedChange}
            onCollapse={collapse}
        />
    );

    return (
        <div
            className={classList("project-tools", compact && "project-tools-compact")}
            ref={root}
            dir={rtl ? "rtl" : "ltr"}
            data-options-open={optionsOpen}
            style={{ "--tools-tab-count": tabNames.length } as React.CSSProperties}
            onBlur={onBlur}
        >
            <div
                className="project-tools-launcher"
                ref={launcher}
            >
                <button
                    id={PROJECT_TOOLS_LAUNCHER_ID}
                    type="button"
                    ref={moreButton}
                    className="project-tools-bubble project-tools-more"
                    aria-label={lf("Project tools")}
                    aria-expanded={optionsOpen}
                    aria-controls="project-tools-options"
                    onClick={() => {
                        if (props.expanded || optionsOpen) {
                            dismissTools(true);
                            moreButton.current?.focus();
                        } else {
                            openOptions();
                        }
                    }}
                    onKeyDown={event => {
                        if (event.key === "Escape") {
                            if (props.expanded) {
                                collapse();
                            } else if (optionsOpen) {
                                setOptionsOpen(false);
                            }
                        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                            event.preventDefault();
                            openOptions();
                        }
                    }}
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <circle
                            cx="5"
                            cy="12"
                            r="2"
                        />
                        <circle
                            cx="12"
                            cy="12"
                            r="2"
                        />
                        <circle
                            cx="19"
                            cy="12"
                            r="2"
                        />
                    </svg>
                    <span
                        className="project-tools-bubble-label"
                        aria-hidden="true"
                    >
                        {lf("Project tools")}
                    </span>
                </button>
                <div
                    id="project-tools-options"
                    className="project-tools-bubbles"
                    role="group"
                    aria-hidden={!optionsOpen}
                    aria-label={lf("Project tools")}
                >
                    {tabNames.map((name, index) => {
                        const label = name === "docs"
                            ? lf("Documentation")
                            : name === "whiteboard" ? lf("Whiteboard") : lf("Backpack");
                        const selected = tab === name;

                        return (
                            <button
                                key={name}
                                id={projectToolTabId(name)}
                                type="button"
                                className="project-tools-bubble"
                                ref={element => bubbleButtons.current[index] = element}
                                style={{ "--tools-bubble-index": index } as React.CSSProperties}
                                aria-label={label}
                                aria-expanded={selected && props.expanded}
                                aria-controls={projectToolPanelId(name)}
                                tabIndex={optionsOpen ? 0 : -1}
                                onClick={() => selectTab(name)}
                                onKeyDown={event => {
                                    if (event.key === "Escape" && props.expanded) {
                                        event.stopPropagation();
                                        collapse();
                                    } else if (event.key === "Escape") {
                                        event.stopPropagation();
                                        setOptionsOpen(false);
                                        moreButton.current?.focus();
                                    } else {
                                        bubbleKeyDown(event, index);
                                    }
                                }}
                            >
                                {name === "backpack" ? (
                                    <svg
                                        className="project-backpack-icon"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                        focusable="false"
                                    >
                                        <path d="M9 5V3h6v2M6 7a4 4 0 0 1 4-3h4a4 4 0 0 1 4 3l2 12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2L6 7ZM8 13h8v5H8ZM7 9h10" />
                                    </svg>
                                ) : (
                                    <i
                                        className={`icon ${index ? "pencil" : "book"}`}
                                        aria-hidden="true"
                                    />
                                )}
                                <span
                                    className="project-tools-bubble-label"
                                    aria-hidden="true"
                                >
                                    {label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
            <div
                id={PROJECT_TOOLS_PANEL_ID}
                ref={panel}
                className={classList("project-tools-panel", resizing && "project-tools-panel-resizing")}
                hidden={!props.expanded}
                style={{
                    width,
                    height,
                    bottom: height === undefined ? undefined : "auto",
                    "--tools-tab-index": tabIndex
                } as React.CSSProperties}
                data-active-tab={tab}
                role="dialog"
                aria-modal="false"
                aria-label={lf("Project tools")}
                tabIndex={-1}
                onKeyDown={event => {
                    if (event.key === "Escape" && !event.defaultPrevented) {
                        event.stopPropagation();
                        collapse();
                    }
                }}
            >
                <div
                    className="project-tools-pointer"
                    aria-hidden="true"
                />
                <ProjectToolsResizeHandle {...widthHandle} />
                <ProjectToolsResizeHandle {...heightHandle} />
                {tab === "docs" && renderHeader(lf("Documentation"), props.docsUrl && props.docsAction)}
                <section
                    id={projectToolPanelId("docs")}
                    role="region"
                    aria-labelledby={projectToolTabId("docs")}
                    hidden={tab !== "docs"}
                    className="project-tools-docs"
                >
                    {props.docsUrl ? props.children : (
                        <div className="project-tools-empty">
                            <i
                                className="icon book"
                                aria-hidden="true"
                            />
                            <h3>{lf("Keep a reference nearby")}</h3>
                            <p>{lf("Open help from a block or the Help menu. Your documentation will appear here.")}</p>
                            <Button
                                type="button"
                                className="project-tools-button"
                                label={lf("Browse reference")}
                                title={lf("Browse reference")}
                                onClick={props.onOpenReference}
                            />
                        </div>
                    )}
                </section>
                {whiteboardEnabled && (
                    <section
                        id={projectToolPanelId("whiteboard")}
                        role="region"
                        aria-labelledby={projectToolTabId("whiteboard")}
                        hidden={tab !== "whiteboard"}
                        className="project-tools-whiteboard"
                    >
                        {visitedWhiteboard && (
                            <ProjectWhiteboard
                                headerId={props.header.id}
                                notes={props.notes}
                                active={props.expanded && tab === "whiteboard"}
                                renderHeader={renderHeader}
                            />
                        )}
                    </section>
                )}
                {backpackEnabled && (
                    <section
                        id={projectToolPanelId("backpack")}
                        role="region"
                        aria-labelledby={projectToolTabId("backpack")}
                        hidden={tab !== "backpack"}
                        className="project-backpack"
                    >
                        {visitedBackpack && (
                            <ProjectBackpack
                                headerId={props.header.id}
                                active={props.expanded && tab === "backpack"}
                                tutorial={props.tutorial || !!props.header.tutorial}
                                openRequest={backpackRequest}
                                renderHeader={renderHeader}
                                onSignIn={props.onSignIn}
                                onModalOpenChange={onModalOpenChange}
                            />
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}