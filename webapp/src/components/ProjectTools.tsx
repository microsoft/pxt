import * as React from "react";
import { ProjectWhiteboard } from "./ProjectWhiteboard";
import { ProjectBackpack } from "./ProjectBackpack";
import { subscribeBackpackOpen } from "../backpack";
import { PROJECT_TOOLS_COMPACT_QUERY } from "../projectToolsState";

const tabNames = ["docs", "whiteboard", "backpack"] as const;
type ProjectToolTab = typeof tabNames[number];

interface ProjectToolsProps {
    header: pxt.workspace.Header;
    notes?: pxt.workspace.ProjectNotes;
    expanded: boolean;
    pinned: boolean;
    docsUrl?: string;
    docsRequest?: number;
    onExpandedChange: (expanded: boolean) => void;
    onPinnedChange: (pinned: boolean) => void;
    onOpenReference: () => void;
    onSignIn: () => void;
    docsAction?: React.ReactNode;
    children?: React.ReactNode;
}

export function ProjectTools(props: ProjectToolsProps) {
    const [tab, setTab] = React.useState<ProjectToolTab>("docs");
    const [visitedWhiteboard, setVisitedWhiteboard] = React.useState(false);
    const [visitedBackpack, setVisitedBackpack] = React.useState(false);
    // Leave initial sizing to the target's responsive sidedocs CSS. An explicit
    // resize is remembered independently of those defaults for this project view.
    const [width, setWidth] = React.useState<number>();
    const [widthRange, setWidthRange] = React.useState({ width: 0, min: 0, max: 0 });
    const [height, setHeight] = React.useState<number>();
    const [heightRange, setHeightRange] = React.useState({ height: 0, max: 0 });
    const [resizing, setResizing] = React.useState(false);
    const [compact, setCompact] = React.useState(() => window.matchMedia(PROJECT_TOOLS_COMPACT_QUERY).matches);
    const [optionsOpen, setOptionsOpen] = React.useState(() => !pxt.BrowserUtils.isTabletSize());
    const [focusedTab, setFocusedTab] = React.useState(0);
    const root = React.useRef<HTMLDivElement>();
    const launcher = React.useRef<HTMLDivElement>();
    const moreButton = React.useRef<HTMLButtonElement>();
    const focusTabOnOpen = React.useRef(false);
    const openingFromDrag = React.useRef(false);
    const modalOpen = React.useRef(false);
    const onModalOpenChange = React.useCallback((open: boolean) => { modalOpen.current = open; }, []);
    const panel = React.useRef<HTMLDivElement>();
    const tabButtons = React.useRef<HTMLButtonElement[]>([]);
    const drag = React.useRef<{ axis: "width" | "height"; position: number; size: number }>();
    const rtl = pxt.Util.isUserLanguageRtl();
    const tabIndex = tabNames.indexOf(tab);
    const measureWidth = React.useCallback(() => {
        const bounds = panel.current.getBoundingClientRect();
        const style = window.getComputedStyle(panel.current);
        const maxWidth = parseFloat(style.maxWidth);
        const minWidth = parseFloat(style.minWidth);
        const max = Math.min(900, Number.isFinite(maxWidth) ? maxWidth : window.innerWidth);
        return { width: bounds.width, min: Math.min(max, Number.isFinite(minWidth) ? minWidth : 256), max };
    }, []);
    const measureHeight = React.useCallback(() => {
        const bounds = panel.current.getBoundingClientRect();
        const maxHeight = parseFloat(window.getComputedStyle(panel.current).maxHeight);
        return { height: bounds.height, max: Number.isFinite(maxHeight) ? maxHeight : Math.max(0, window.innerHeight - bounds.top) };
    }, []);
    const updateSizeRanges = React.useCallback(() => {
        const height = measureHeight();
        const width = measureWidth();
        setHeightRange(previous => previous.height === height.height && previous.max === height.max ? previous : height);
        setWidthRange(previous => previous.width === width.width && previous.min === width.min && previous.max === width.max ? previous : width);
    }, [measureHeight, measureWidth]);
    // Deferred iframe/focus events must honor the latest pin state, not the
    // state captured before the user clicked Pin or opened an example.
    const pinState = React.useRef({ pinned: props.pinned, expanded: props.expanded });
    pinState.current = { pinned: props.pinned, expanded: props.expanded };
    const dismissTools = React.useCallback((explicit = false) => {
        if (!explicit && (modalOpen.current || pinState.current.pinned && pinState.current.expanded)) return;
        // Desktop tabs remain available after click-away; only an explicit
        // disclosure action hides them. Read the current size for deferred blur.
        if (explicit || pxt.BrowserUtils.isTabletSize()) setOptionsOpen(false);
        if (pinState.current.expanded) props.onExpandedChange(false);
    }, [props.onExpandedChange]);

    React.useEffect(() => subscribeBackpackOpen(request => {
        if (request.headerId !== props.header.id) return;
        // Native Blockly dragging must retain pointer capture and workspace focus.
        openingFromDrag.current = !request.focus;
        focusTabOnOpen.current = request.focus;
        setVisitedBackpack(true);
        setTab("backpack");
        setOptionsOpen(true);
        props.onExpandedChange(true);
    }), [props.header.id, props.onExpandedChange]);
    React.useEffect(() => {
        const query = window.matchMedia(PROJECT_TOOLS_COMPACT_QUERY);
        const tabletQuery = window.matchMedia(`(max-width: ${pxt.BREAKPOINT_TABLET}px)`);
        // Changing strip direction must not undo an explicit desktop collapse.
        const onChange = () => setCompact(query.matches);
        const onTabletChange = () => {
            if (tabletQuery.matches) {
                // Move focus before hiding tabs, without dismissing an open panel.
                if (launcher.current?.contains(document.activeElement)) moreButton.current?.focus();
                else if (document.activeElement === panel.current?.querySelector(".project-tools__resize--width")) panel.current?.focus();
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
        if (!props.expanded) return undefined;
        updateSizeRanges();
        const observer = new ResizeObserver(updateSizeRanges);
        observer.observe(panel.current);
        window.addEventListener("resize", updateSizeRanges);
        // Banner visibility moves the top edge without necessarily resizing a
        // manually sized panel. Keep the keyboard/ARIA limits in sync as well.
        const layoutRoot = panel.current.closest("#root");
        const mutations = new MutationObserver(updateSizeRanges);
        if (layoutRoot) mutations.observe(layoutRoot, { attributes: true, attributeFilter: ["class"] });
        return () => {
            observer.disconnect();
            mutations.disconnect();
            window.removeEventListener("resize", updateSizeRanges);
        };
    }, [props.expanded, compact, updateSizeRanges]);
    React.useLayoutEffect(() => {
        // Only user-initiated expansion moves focus, not desktop startup or resize.
        if (!focusTabOnOpen.current || !optionsOpen) return;
        focusTabOnOpen.current = false;
        tabButtons.current[tabIndex]?.focus();
    }, [optionsOpen, tabIndex]);
    React.useEffect(() => {
        if (!props.expanded && !optionsOpen) return undefined;
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
            if (props.expanded && (compact || !optionsOpen)) panel.current?.focus();
        }
    }, [props.docsUrl, props.docsRequest]);
    React.useEffect(() => {
        if (props.expanded) {
            if (openingFromDrag.current) return;
            if (!optionsOpen) panel.current?.focus();
            else tabButtons.current[tabIndex]?.focus();
        }
    }, [props.expanded]);
    React.useEffect(() => {
        if (props.expanded && tab === "whiteboard") setVisitedWhiteboard(true);
        if (props.expanded && tab === "backpack") setVisitedBackpack(true);
    }, [props.expanded, tab]);

    const openOptions = () => {
        openingFromDrag.current = false;
        if (optionsOpen) tabButtons.current[tabIndex]?.focus();
        else {
            focusTabOnOpen.current = true;
            setOptionsOpen(true);
        }
    };
    const collapse = () => {
        openingFromDrag.current = false;
        props.onExpandedChange(false);
        if (!optionsOpen) moreButton.current?.focus();
        else tabButtons.current[tabIndex]?.focus();
    };
    const selectTab = (name: ProjectToolTab) => {
        openingFromDrag.current = false;
        if (props.expanded && tab === name) collapse();
        else {
            setTab(name);
            props.onExpandedChange(true);
        }
    };
    const tabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        let next: number;
        switch (event.key) {
            case "ArrowUp": if (!compact) next = index - 1; break;
            case "ArrowDown": if (!compact) next = index + 1; break;
            case "ArrowLeft": if (compact) next = index + (rtl ? 1 : -1); break;
            case "ArrowRight": if (compact) next = index + (rtl ? -1 : 1); break;
            case "Home": next = 0; break;
            case "End": next = tabNames.length - 1; break;
            default: return;
        }
        if (next === undefined) return;
        event.preventDefault();
        next = (next + tabNames.length) % tabNames.length;
        if (!compact) setTab(tabNames[next]);
        tabButtons.current[next]?.focus();
    };
    const resizeWidth = (value: number) => {
        const { min, max } = measureWidth();
        setWidth(Math.max(min, Math.min(max, value)));
    };
    const resizeHeight = (value: number) => {
        const { max } = measureHeight();
        setHeight(Math.min(max, Math.max(Math.min(240, max), value)));
    };
    const startResize = (event: React.PointerEvent<HTMLDivElement>, axis: "width" | "height") => {
        if (event.button !== 0 || drag.current) return;
        event.preventDefault();
        const bounds = panel.current.getBoundingClientRect();
        drag.current = { axis, position: axis === "width" ? event.clientX : event.clientY, size: bounds[axis] };
        event.currentTarget.setPointerCapture(event.pointerId);
        setResizing(true);
    };
    const moveResize = (event: React.PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current) return;
        if (current.axis === "width") resizeWidth(current.size + (event.clientX - current.position) * (rtl ? 1 : -1));
        else resizeHeight(current.size + event.clientY - current.position);
    };
    const stopResize = (event: React.PointerEvent<HTMLDivElement>) => {
        drag.current = undefined;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        setResizing(false);
    };
    const lostResizeCapture = () => { drag.current = undefined; setResizing(false); };
    const renderHeader = (title: string, actions?: React.ReactNode) => <div className="project-tools__header">
        <h2 className="project-tools__title" title={title}>{title}</h2>
        {actions}
        <button type="button" className="project-tools__pin" aria-pressed={props.pinned}
            aria-label={lf("Keep project tools open")} title={props.pinned ? lf("Unpin project tools") : lf("Pin project tools open")}
            onClick={() => props.onPinnedChange(!props.pinned)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path className="project-tools__pin-head" d="M8 3h8v3l-1 1v5l3 3v2H6v-2l3-3V7L8 6Z" />
                <path d="M12 17v5" />
            </svg>
        </button>
        <button type="button" className="project-tools__close" title={lf("Collapse project tools")}
            aria-label={lf("Collapse project tools")} onClick={collapse}><i className="icon minus" aria-hidden="true" /></button>
    </div>;

    return <div className={`project-tools${compact ? " project-tools--compact" : ""}`}
        ref={root} dir={rtl ? "rtl" : "ltr"} data-options-open={optionsOpen}
        style={{ "--tools-tab-count": tabNames.length } as React.CSSProperties} onBlur={event => {
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
            <button id="project-tools-launcher" type="button" ref={moreButton}
                className="project-tools__bubble project-tools__more" aria-label={lf("Project tools")}
                title={lf("Project tools")} aria-expanded={optionsOpen} aria-controls="project-tools-options"
                onClick={() => {
                    if (props.expanded || optionsOpen) {
                        dismissTools(true);
                        moreButton.current?.focus();
                    } else openOptions();
                }} onKeyDown={event => {
                    if (event.key === "Escape") {
                        if (props.expanded) collapse();
                        else if (optionsOpen) setOptionsOpen(false);
                    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        openOptions();
                    }
                }}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                </svg>
            </button>
            <div id="project-tools-options" className="project-tools__bubbles" role="tablist"
                aria-hidden={!optionsOpen} aria-orientation={compact ? "horizontal" : "vertical"} aria-label={lf("Project tools")}>
                {[lf("Documentation"), lf("Whiteboard"), lf("Backpack")].map((label, index) => {
                    const name = tabNames[index];
                    const selected = tab === name;
                    return <button key={name} id={`project-tools-tab-${name}`} type="button" role="tab"
                        className="project-tools__bubble" ref={element => tabButtons.current[index] = element}
                        style={{ "--tools-bubble-index": index } as React.CSSProperties}
                        aria-label={label} title={label} aria-selected={selected && props.expanded}
                        aria-expanded={selected && props.expanded} aria-controls={`project-tools-${name}`}
                        tabIndex={optionsOpen && (compact ? focusedTab === index : selected) ? 0 : -1}
                        onFocus={() => setFocusedTab(index)} onClick={() => selectTab(name)}
                        onKeyDown={event => {
                            if (event.key === "Escape" && props.expanded) {
                                event.stopPropagation();
                                collapse();
                            } else if (event.key === "Escape") {
                                event.stopPropagation();
                                setOptionsOpen(false);
                                moreButton.current?.focus();
                            } else tabKeyDown(event, index);
                        }}>
                        {name === "backpack" ? <svg className="project-backpack__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M9 5V3h6v2M6 7a4 4 0 0 1 4-3h4a4 4 0 0 1 4 3l2 12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2L6 7ZM8 13h8v5H8ZM7 9h10" />
                        </svg> : <i className={`icon ${index ? "pencil" : "book"}`} aria-hidden="true" />}
                        <span className="project-tools__bubble-label">{label}</span>
                    </button>;
                })}
            </div>
        </div>
        <div id="project-tools-panel" ref={panel} className={`project-tools__panel${resizing ? " project-tools__panel--resizing" : ""}`}
            hidden={!props.expanded} style={{ width, height, bottom: height === undefined ? undefined : "auto",
                "--tools-tab-index": tabIndex } as React.CSSProperties} data-active-tab={tab}
            role="dialog" aria-modal="false" aria-label={lf("Project tools")} tabIndex={-1}
            onKeyDown={event => {
                if (event.key === "Escape" && !event.defaultPrevented) {
                    event.stopPropagation();
                    collapse();
                }
            }}>
            <div className="project-tools__pointer" aria-hidden="true" />
            <div className="project-tools__resize project-tools__resize--width" role="separator" aria-orientation="vertical" tabIndex={0}
                aria-label={lf("Resize project tools width")} title={lf("Resize project tools width")}
                aria-controls="project-tools-panel"
                aria-valuemin={widthRange.min} aria-valuemax={widthRange.max} aria-valuenow={widthRange.width}
                onFocus={updateSizeRanges}
                onBlur={event => {
                    // CSS may hide the grip before the media-query callback runs.
                    // This is a layout change, not a user clicking away from tools.
                    if (window.getComputedStyle(event.currentTarget).display === "none") {
                        event.stopPropagation();
                        panel.current?.focus();
                    }
                }}
                onPointerDown={event => startResize(event, "width")} onPointerMove={moveResize}
                onPointerUp={stopResize} onPointerCancel={stopResize} onLostPointerCapture={lostResizeCapture}
                onKeyDown={event => {
                    if (["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(event.key) < 0) return;
                    event.preventDefault();
                    if (event.key === "Home") resizeWidth(measureWidth().min);
                    else if (event.key === "End") resizeWidth(900);
                    else resizeWidth(measureWidth().width + (event.key === "ArrowLeft" ? 1 : -1) * (rtl ? -1 : 1) * (event.shiftKey ? 80 : 20));
                }}>
                <svg className="project-tools__resize-grip" viewBox="0 0 8 20" aria-hidden="true" focusable="false">
                    <circle cx="2" cy="4" r="1" />
                    <circle cx="6" cy="4" r="1" />
                    <circle cx="2" cy="10" r="1" />
                    <circle cx="6" cy="10" r="1" />
                    <circle cx="2" cy="16" r="1" />
                    <circle cx="6" cy="16" r="1" />
                </svg>
            </div>
            <div className="project-tools__resize project-tools__resize--height" role="separator" aria-orientation="horizontal" tabIndex={0}
                aria-label={lf("Resize project tools height")} title={lf("Resize project tools height")}
                aria-controls="project-tools-panel" aria-valuemin={Math.min(240, heightRange.max)}
                aria-valuemax={heightRange.max} aria-valuenow={heightRange.height}
                onFocus={updateSizeRanges}
                onPointerDown={event => startResize(event, "height")} onPointerMove={moveResize}
                onPointerUp={stopResize} onPointerCancel={stopResize} onLostPointerCapture={lostResizeCapture}
                onKeyDown={event => {
                    if (["ArrowUp", "ArrowDown", "Home", "End"].indexOf(event.key) < 0) return;
                    event.preventDefault();
                    if (event.key === "Home") resizeHeight(240);
                    else if (event.key === "End") setHeight(undefined); // Fill the available space again.
                    else resizeHeight(measureHeight().height + (event.key === "ArrowDown" ? 1 : -1) * (event.shiftKey ? 80 : 20));
                }}>
                <svg className="project-tools__resize-grip" viewBox="0 0 20 8" aria-hidden="true" focusable="false">
                    <circle cx="4" cy="2" r="1" />
                    <circle cx="4" cy="6" r="1" />
                    <circle cx="10" cy="2" r="1" />
                    <circle cx="10" cy="6" r="1" />
                    <circle cx="16" cy="2" r="1" />
                    <circle cx="16" cy="6" r="1" />
                </svg>
            </div>
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
            <section id="project-tools-backpack" role="tabpanel" aria-labelledby="project-tools-tab-backpack" hidden={tab !== "backpack"}
                className="project-backpack">
                {visitedBackpack && <ProjectBackpack headerId={props.header.id} active={props.expanded && tab === "backpack"}
                    renderHeader={renderHeader} onSignIn={props.onSignIn} onModalOpenChange={onModalOpenChange} />}
            </section>
        </div>
    </div>;
}