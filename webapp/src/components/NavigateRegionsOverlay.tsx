import { useEffect, useRef, useState } from "react";
import * as ReactDOM from "react-dom";
import { Button, ButtonProps } from "../../../react-common/components/controls/Button";
import { FocusTrap } from "../../../react-common/components/controls/FocusTrap";

import IProjectView = pxt.editor.IProjectView;

interface NavigateRegionsOverlayProps {
    parent: IProjectView;
}

interface RectBounds {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
}

type RegionId = "mainmenu" | "simulator" | "toolbox" | "editor" | "editortools" | "tutorial";

interface Region {
    id: RegionId;
    ariaLabel: string;
    shortcutKey: string;
    getClassName?(projectView: IProjectView): string | undefined;
    getBounds(projectView: IProjectView): DOMRect | undefined;
    focus(projectView: IProjectView): void;
}

const getToolboxBounds = (projectView: IProjectView): DOMRect | undefined => {
    return document.querySelector(`${projectView.isBlocksActive() ? ".blocklyToolbox" : ".monacoToolboxDiv"}`)?.getBoundingClientRect();
}

const isSimMini = () => !!document.querySelector(".miniSim");

const regions: Region[] = [
    {
        id: "mainmenu",
        ariaLabel: lf("Main menu"),
        shortcutKey: "1",
        getBounds() {
            return document.querySelector("#mainmenu")?.getBoundingClientRect();
        },
        focus() {
            findFirstFocusableDescendant(
                document.querySelector("#mainmenu")!,
                (e) =>
                    // This isn't actually focusable and has the same behavior as home.
                    e.classList.contains("brand") ||
                    // The menuitem containing the editor toggle.
                    !!Array.from(e.children).find(e => e.id === "editortoggle")
            )?.focus();
        }
    },
    {
        id: "simulator",
        ariaLabel: lf("Simulator"),
        shortcutKey: "2",
        getBounds(projectView: IProjectView) {
            const element = isSimMini()
                ? document.querySelector(".simPanel")
                : projectView.state.collapseEditorTools ?
                    document.querySelector("#computertogglesim")
                    : document.querySelector("#editorSidebar")
            const bounds = element?.getBoundingClientRect();
            if (!bounds) {
                return undefined;
            }
            if (projectView.state.collapseEditorTools) {
                // Custom presentation for the collapsed sim.
                const isRtl = pxt.Util.isUserLanguageRtl();
                const collapsedSimPadding = 30;
                const copy = DOMRect.fromRect(bounds);
                copy.y = bounds.top - collapsedSimPadding;
                copy.width = 70;
                copy.height = bounds.height + collapsedSimPadding * 2;
                if (isRtl) {
                    copy.x -= copy.width - bounds.width;
                }
                return copy;
            }
            return bounds;
        },
        focus(projectView: IProjectView) {
            // Note that pxtsim.driver.focus() isn't the same as tabbing to the sim.
            if (isSimMini()) {
                projectView.setSimulatorFullScreen(true);
            } else {
                if (projectView.state.collapseEditorTools) {
                    projectView.toggleSimulatorCollapse();
                }
                (document.querySelector("#boardview") as HTMLElement)?.focus();
            }
        },
        getClassName(projectView: IProjectView) {
            const classNames = ["simulator-region"];
            if (projectView.state.collapseEditorTools) {
                classNames.push("simulator-collapsed");
            }
            return classNames.join(" ");
        },
    },
    {
        id: "toolbox",
        ariaLabel: lf("Toolbox"),
        shortcutKey: "3",
        getBounds(projectView: IProjectView) {
            const bounds = getToolboxBounds(projectView);
            if (!bounds) {
                return undefined;
            }
            if (projectView.state.collapseEditorTools) {
                const isRtl = pxt.Util.isUserLanguageRtl();
                // Shift over for a clearer region when the toolbox is collapsed
                const copy = DOMRect.fromRect(bounds);
                if (isRtl) {
                    copy.width += document.body.clientWidth - bounds.right;
                } else {
                    copy.x = 0;
                    copy.width = bounds.x + bounds.width;
                }
                return copy;
            }
            return bounds;
        },
        focus(projectView: IProjectView) {
            projectView.editor.focusToolbox();
        }
    },
    {
        id: "editor",
        ariaLabel: lf("Editor"),
        shortcutKey: "4",
        getBounds(projectView: IProjectView) {
            const editorSelectors = ["#pxtJsonEditor", "#githubEditor", "#blocksArea", "#serialEditor", "#assetEditor", "#monacoEditor"];
            for (const selector of editorSelectors) {
                const element = document.querySelector(selector) as HTMLElement | null;
                if (element.offsetParent !== null) {
                    const bounds = element.getBoundingClientRect();
                    if (selector === "#monacoEditor" || selector === "#blocksArea") {
                        // Use bounds that don't overlap the toolbox region.
                        const isRtl = pxt.Util.isUserLanguageRtl();
                        const toolbox = getToolboxBounds(projectView);
                        const copied = DOMRect.fromRect(bounds);
                        if (toolbox) {
                            copied.width -= toolbox.width;
                            if (!isRtl) {
                                copied.x = toolbox.right;
                            }
                        }
                        return copied;
                    }
                    return bounds;
                }
            }
            return undefined;
        },
        focus(projectView: IProjectView) {
            if (projectView.isPxtJsonEditor()) {
                findFirstFocusableDescendant(document.querySelector("#pxtJsonEditor"))?.focus();
            } else {
                projectView.editor.focusWorkspace();
            }
        }
    },
    {
        id: "editortools",
        ariaLabel: lf("Editor toolbar"),
        shortcutKey: "5",
        getBounds() {
            return document.querySelector("#editortools")?.getBoundingClientRect();
        },
        focus() {
            findFirstFocusableDescendant(document.querySelector("#editortools")!)?.focus();
        }
    },
    {
        id: "tutorial",
        ariaLabel: lf("Tutorial"),
        // This isn't really in sequence but it's not usually present.
        shortcutKey: "0",
        getBounds() {
            return document.querySelector(".tutorialWrapper")?.getBoundingClientRect();
        },
        focus() {
            findFirstFocusableDescendant(document.querySelector(".tutorialWrapper")!)?.focus();
        }
    },
];

export const NavigateRegionsOverlay = ({ parent }: NavigateRegionsOverlayProps) => {
    const previouslyFocused = useRef<Element>(document.activeElement);
    const getRects = (): Map<RegionId, DOMRect | undefined> => (
        new Map(regions.map(region => [region.id, region.getBounds(parent)]))
    );
    const [regionRects, setRegionRects] = useState(getRects());

    useEffect(() => {
        if (parent.state.fullscreen) {
            parent.setSimulatorFullScreen(false);
        }

        const listener = (e: KeyboardEvent) => {
            const region = regions.find(region => region.shortcutKey === e.key);
            if (region) {
                e.preventDefault();
                region.focus(parent);
                parent.hideNavigateRegions();
            }
        }
        document.addEventListener("keydown", listener)

        const observer = new ResizeObserver(() => {
            setRegionRects(getRects())
        });
        observer.observe(document.body);

        return () => {
            observer.disconnect()
            document.removeEventListener("keydown", listener)
        }
    }, [])

    const handleEscape = () => {
        if (previouslyFocused.current) {
            (previouslyFocused.current as HTMLElement).focus()
        }
        parent.hideNavigateRegions();
    }

    if (!regionRects.get("editor")) {
        // Something is awry, bail out.
        parent.hideNavigateRegions();
        return null;
    }

    return ReactDOM.createPortal(
        <FocusTrap dontRestoreFocus onEscape={handleEscape}>
            <div className="navigate-regions-container">
                {regions.map(region => {
                    const rect = regionRects.get(region.id);
                    return rect ? (<RegionButton
                        key={region.id}
                        title={region.ariaLabel}
                        shortcutKey={region.shortcutKey}
                        bounds={rect}
                        onClick={() => {
                            region.focus(parent);
                            parent.hideNavigateRegions();
                        }}
                        ariaLabel={region.ariaLabel}
                        className={region.getClassName?.(parent)}
                    />) : null;
                })}
            </div>
        </FocusTrap>,
        document.getElementById("root") || document.body
    );
}

interface RegionButtonProps extends ButtonProps {
    shortcutKey: string;
    bounds: RectBounds;
}

const RegionButton = ({ shortcutKey, bounds, ...props }: RegionButtonProps) => {
    const { top, height, left, width } = bounds;
    return <Button
        {...props}
        className={`region-button ${props.className}`}
        style={{
            top, height, left, width
        }}
    >
        <div><p>{shortcutKey.toUpperCase()}</p></div>
    </Button>
}

/**
 * Find the first focusable descendant element within a given element.
 */
function findFirstFocusableDescendant(element: HTMLElement, skip?: (element: Element) => boolean): HTMLElement | null {
    const nativelyFocusableSelectors = [
        '[contenteditable]:not([contenteditable="false"])',
        'a[href]',
        'audio[controls]',
        'button:not([disabled])',
        'details > summary:first-of-type',
        'iframe',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'video[controls]',
    ];
    const ariaFocusableRoles = [
        'button',
        'checkbox',
        'combobox',
        'dialog',
        'gridcell',
        'link',
        'menuitem',
        'menuitemcheckbox',
        'menuitemradio',
        'option',
        'radio',
        'searchbox',
        'slider',
        'spinbutton',
        'switch',
        'tab',
        'textbox',
        'treeitem'
    ];
    const selectors = [
        ...nativelyFocusableSelectors,
        '[tabindex]:not([tabindex="-1"])',
        ...ariaFocusableRoles.map(role => `[role="${role}"]`)
    ];
    const candidates = Array.from(
        element.querySelectorAll<HTMLElement>(selectors.join(','))
    );
    // Could also sequence by tabindex here but assuming only 0/-1 used.
    return candidates.find(candidate => {
        // This can be replaced with checkVisibility when types/support allows.
        if (candidate.offsetParent === null) {
            return false;
        }
        if (candidate.ariaHidden === 'true') {
            return false;
        }
        if (candidate.inert || candidate.closest('[inert]')) {
            return false;
        }
        if (candidate.ariaDisabled === 'true') {
            return false;
        }
        if (candidate.closest('fieldset[disabled]')) {
            return false;
        }
        if (skip?.(candidate)) {
            return false;
        }
        return true;
    });
}