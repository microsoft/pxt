import * as React from "react";
import { ProjectWhiteboard } from "./ProjectWhiteboard";

interface ProjectToolsProps {
    header: pxt.workspace.Header;
    notes?: pxt.workspace.ProjectNotes;
    expanded: boolean;
    docsUrl?: string;
    docsRequest?: number;
    onExpandedChange: (expanded: boolean) => void;
    onOpenReference: () => void;
    docsAction?: React.ReactNode;
    children?: React.ReactNode;
}

export function ProjectTools(props: ProjectToolsProps) {
    const [tab, setTab] = React.useState<"docs" | "whiteboard">("docs");
    const [visitedWhiteboard, setVisitedWhiteboard] = React.useState(false);
    const [width, setWidth] = React.useState(600);
    const [resizing, setResizing] = React.useState(false);
    const [compact, setCompact] = React.useState(() => pxt.BrowserUtils.isTabletSize());
    const [optionsOpen, setOptionsOpen] = React.useState(false);
    const [focusedTab, setFocusedTab] = React.useState(0);
    const root = React.useRef<HTMLDivElement>();
    const launcher = React.useRef<HTMLDivElement>();
    const moreButton = React.useRef<HTMLButtonElement>();
    const pendingFocus = React.useRef<"panel" | "trigger">();
    const panel = React.useRef<HTMLDivElement>();
    const tabButtons = React.useRef<HTMLButtonElement[]>([]);
    const drag = React.useRef<{ x: number; width: number }>();
    const rtl = pxt.Util.isUserLanguageRtl();
    const dismissTools = React.useCallback(() => {
        setOptionsOpen(false);
        props.onExpandedChange(false);
    }, [props.onExpandedChange]);

    React.useEffect(() => {
        const query = window.matchMedia(`(max-width: ${pxt.BREAKPOINT_TABLET}px)`);
        const onChange = () => {
            if (launcher.current?.contains(document.activeElement)) pendingFocus.current = "trigger";
            else if (query.matches && document.activeElement === panel.current?.querySelector(".project-tools__resize")) {
                pendingFocus.current = "panel";
            }
            setCompact(query.matches);
            setOptionsOpen(false);
        };
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);
    React.useLayoutEffect(() => {
        if (!pendingFocus.current) return;
        const target = pendingFocus.current === "panel" ? panel.current
            : compact ? moreButton.current : tabButtons.current[tab === "docs" ? 0 : 1];
        pendingFocus.current = undefined;
        target?.focus();
    });
    React.useEffect(() => {
        if (compact && optionsOpen) tabButtons.current[tab === "docs" ? 0 : 1]?.focus();
    }, [compact, optionsOpen]);
    React.useEffect(() => {
        if (!props.expanded && !(compact && optionsOpen)) return undefined;
        const onPointerDown = (event: PointerEvent) => {
            if (root.current && !root.current.contains(event.target as Node)) dismissTools();
        };
        let frame: number;
        const onWindowBlur = () => {
            if (frame !== undefined) window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(() => {
                frame = undefined;
                const active = document.activeElement;
                // Iframe pointer events do not reach this document. Treat focus
                // entering the simulator as outside, but leave the docs frame open.
                if (root.current && active instanceof HTMLIFrameElement && !root.current.contains(active)) dismissTools();
            });
        };
        // Blockly and Monaco can stop bubbling pointer events; do not prevent
        // the clicked control from receiving its normal action or focus.
        document.addEventListener("pointerdown", onPointerDown, true);
        window.addEventListener("blur", onWindowBlur);
        // Moving directly from docs to the simulator blurs only the docs window,
        // not the parent. Reattach after navigation because its window may change.
        const removeFrameListeners = Array.from(root.current?.querySelectorAll("iframe") || []).map(iframe => {
            let frameWindow: Window;
            const detach = () => {
                try { frameWindow?.removeEventListener("blur", onWindowBlur); }
                catch { /* The iframe may have navigated to another origin. */ }
                frameWindow = undefined;
            };
            const attach = () => {
                detach();
                try {
                    frameWindow = iframe.contentWindow;
                    frameWindow?.addEventListener("blur", onWindowBlur);
                } catch {
                    // Cross-origin content is inaccessible; retain the parent listener.
                    frameWindow = undefined;
                }
            };
            iframe.addEventListener("load", attach);
            attach();
            return () => { iframe.removeEventListener("load", attach); detach(); };
        });
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            window.removeEventListener("blur", onWindowBlur);
            removeFrameListeners.forEach(remove => remove());
            if (frame !== undefined) window.cancelAnimationFrame(frame);
        };
    }, [compact, optionsOpen, props.expanded, props.docsUrl, props.docsRequest, dismissTools]);
    React.useEffect(() => {
        if (props.docsUrl) {
            setTab("docs");
            if (compact && props.expanded) panel.current?.focus();
        }
    }, [props.docsUrl, props.docsRequest]);
    React.useEffect(() => {
        if (props.expanded) {
            if (compact && !optionsOpen) panel.current?.focus();
            else tabButtons.current[tab === "docs" ? 0 : 1]?.focus();
        }
    }, [props.expanded]);
    React.useEffect(() => {
        if (props.expanded && tab === "whiteboard") setVisitedWhiteboard(true);
    }, [props.expanded, tab]);

    const collapse = () => {
        props.onExpandedChange(false);
        if (compact && !optionsOpen) moreButton.current?.focus();
        else tabButtons.current[tab === "docs" ? 0 : 1]?.focus();
    };
    const selectTab = (name: "docs" | "whiteboard") => {
        if (props.expanded && tab === name) collapse();
        else {
            setTab(name);
            props.onExpandedChange(true);
        }
    };
    const tabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        let next: number;
        switch (event.key) {
            case "ArrowUp": case "ArrowDown": if (!compact) next = 1 - index; break;
            case "ArrowLeft": case "ArrowRight": if (compact) next = 1 - index; break;
            case "Home": next = 0; break;
            case "End": next = 1; break;
            default: return;
        }
        if (next === undefined) return;
        event.preventDefault();
        if (!compact) setTab(next ? "whiteboard" : "docs");
        tabButtons.current[next]?.focus();
    };
    const resize = (value: number) => setWidth(Math.max(360, Math.min(900, window.innerWidth - 80, value)));
    const renderHeader = (title: string, actions?: React.ReactNode) => <div className="project-tools__header">
        <h2 className="project-tools__title" title={title}>{title}</h2>
        {actions}
        <button type="button" className="project-tools__close" title={lf("Collapse project tools")}
            aria-label={lf("Collapse project tools")} onClick={collapse}><i className="icon minus" aria-hidden="true" /></button>
    </div>;

    return <div className={`project-tools${compact ? " project-tools--compact" : ""}`}
        ref={root} dir={rtl ? "rtl" : "ltr"} data-options-open={optionsOpen} onBlur={event => {
            if (event.relatedTarget) {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) dismissTools();
            } else {
                // Focus entering the docs iframe has no relatedTarget. Wait until
                // activeElement reflects the iframe before deciding focus left us.
                window.requestAnimationFrame(() => {
                    if (root.current && !root.current.contains(document.activeElement)) dismissTools();
                });
            }
        }}>
        <div className="project-tools__launcher" ref={launcher}>
            {compact && <button id="project-tools-launcher" type="button" ref={moreButton}
                className="project-tools__bubble project-tools__more" aria-label={lf("Project tools")}
                title={lf("Project tools")} aria-expanded={optionsOpen} aria-controls="project-tools-options"
                onClick={() => {
                    if (props.expanded || optionsOpen) {
                        dismissTools();
                        moreButton.current?.focus();
                    } else setOptionsOpen(true);
                }} onKeyDown={event => {
                    if (event.key === "Escape") {
                        if (props.expanded) collapse();
                        else if (optionsOpen) setOptionsOpen(false);
                    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        if (optionsOpen) tabButtons.current[tab === "docs" ? 0 : 1]?.focus();
                        else setOptionsOpen(true);
                    }
                }}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                </svg>
            </button>}
            <div id="project-tools-options" className="project-tools__bubbles" role="tablist"
                aria-hidden={compact && !optionsOpen} aria-orientation={compact ? "horizontal" : "vertical"} aria-label={lf("Project tools")}>
                {[lf("Documentation"), lf("Whiteboard")].map((label, index) => {
                    const name = index ? "whiteboard" : "docs";
                    const selected = tab === name;
                    return <button key={name} id={`project-tools-tab-${name}`} type="button" role="tab"
                        className="project-tools__bubble" ref={element => tabButtons.current[index] = element}
                        aria-label={label} title={label} aria-selected={selected && props.expanded}
                        aria-expanded={selected && props.expanded} aria-controls={`project-tools-${name}`}
                        tabIndex={(compact ? optionsOpen && focusedTab === index : selected) ? 0 : -1}
                        onFocus={() => setFocusedTab(index)} onClick={() => selectTab(name)}
                        onKeyDown={event => {
                            if (event.key === "Escape" && props.expanded) {
                                event.stopPropagation();
                                collapse();
                            } else if (event.key === "Escape" && compact) {
                                event.stopPropagation();
                                setOptionsOpen(false);
                                moreButton.current?.focus();
                            } else tabKeyDown(event, index);
                        }}>
                        <i className={`icon ${index ? "pencil" : "book"}`} aria-hidden="true" />
                        <span className="project-tools__bubble-label">{label}</span>
                    </button>;
                })}
            </div>
        </div>
        <div id="project-tools-panel" ref={panel} className={`project-tools__panel${resizing ? " project-tools__panel--resizing" : ""}`}
            hidden={!props.expanded} style={{ width }} data-active-tab={tab}
            role="dialog" aria-modal="false" aria-label={lf("Project tools")} tabIndex={-1}
            onKeyDown={event => {
                if (event.key === "Escape" && !event.defaultPrevented) {
                    event.stopPropagation();
                    collapse();
                }
            }}>
            <div className="project-tools__pointer" aria-hidden="true" />
            <div className="project-tools__resize" role="separator" aria-orientation="vertical" tabIndex={0}
                aria-label={lf("Resize project tools")} aria-valuemin={360} aria-valuemax={900} aria-valuenow={width}
                onPointerDown={event => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    drag.current = { x: event.clientX, width: panel.current.getBoundingClientRect().width };
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setResizing(true);
                }}
                onPointerMove={event => {
                    if (drag.current) resize(drag.current.width + (event.clientX - drag.current.x) * (rtl ? 1 : -1));
                }}
                onPointerUp={event => {
                    drag.current = undefined;
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                    setResizing(false);
                }}
                onLostPointerCapture={() => { drag.current = undefined; setResizing(false); }}
                onKeyDown={event => {
                    if (["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(event.key) < 0) return;
                    event.preventDefault();
                    if (event.key === "Home") resize(360);
                    else if (event.key === "End") resize(900);
                    else resize(width + (event.key === "ArrowLeft" ? 1 : -1) * (rtl ? -1 : 1) * (event.shiftKey ? 80 : 20));
                }} />
            {tab === "docs" && renderHeader(lf("Documentation"), props.docsUrl && props.docsAction)}
            <section id="project-tools-docs" role="tabpanel" aria-labelledby="project-tools-tab-docs" hidden={tab !== "docs"}
                className="project-tools__docs">
                {props.docsUrl ? props.children : <div className="project-tools__empty">
                    <i className="icon book" aria-hidden="true" />
                    <h3>{lf("Keep a reference nearby")}</h3>
                    <p>{lf("Open help from a block or the Help menu. Your documentation will appear here.")}</p>
                    <button type="button" onClick={props.onOpenReference}>{lf("Browse reference")}</button>
                </div>}
            </section>
            <section id="project-tools-whiteboard" role="tabpanel" aria-labelledby="project-tools-tab-whiteboard" hidden={tab !== "whiteboard"}
                className="project-tools__whiteboard">
                {visitedWhiteboard && <ProjectWhiteboard headerId={props.header.id} notes={props.notes}
                    active={props.expanded && tab === "whiteboard"} renderHeader={renderHeader} />}
            </section>
        </div>
    </div>;
}