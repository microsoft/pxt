import * as React from "react";
import * as compiler from "./compiler"
import * as core from "./core";
import * as toolbox from "./toolbox";
import * as workspace from "./workspace";

const DRAG_THRESHOLD = 5;
const SELECTED_BORDER_WIDTH = 4;

interface BlockDragInfo {
    x: number;
    y: number;
    block?: toolbox.BlockDefinition;
    snippet?: string;
    color?: string;
}

export interface MonacoFlyoutProps extends pxt.editor.ISettingsProps {
    fileType?: pxt.editor.FileType;
    blockIdMap?: pxt.Map<string>;
    moveFocusToParent?: () => void;
    insertSnippet?: (position: monaco.Position, insertText: string, inline?: boolean) => void;
    setInsertionSnippet?: (snippet: string) => void;
}

export interface MonacoFlyoutState {
    name?: string;
    ns?: string;
    color?: string;
    icon?: string;
    groups?: toolbox.GroupDefinition[];
    selectedBlock?: string;
}

export class MonacoFlyout extends React.Component<MonacoFlyoutProps, MonacoFlyoutState> {
    protected dragging: boolean = false;
    protected dragInfo: BlockDragInfo = { x: undefined, y: undefined };

    constructor(props: MonacoFlyoutProps) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
        document.addEventListener(pxt.BrowserUtils.pointerEvents.move, this.blockDragHandler);
        document.addEventListener(pxt.BrowserUtils.pointerEvents.up, this.blockDragEndHandler);
    }

    componentWillUnmount() {
        document.removeEventListener(pxt.BrowserUtils.pointerEvents.move, this.blockDragHandler);
        document.removeEventListener(pxt.BrowserUtils.pointerEvents.up, this.blockDragEndHandler)
    }

    componentDidUpdate() {
        this.positionDragHandle();
    }

    protected getBlockClickHandler = (name: string) => {
        pxt.tickEvent("monaco.toolbox.itemclick", undefined, { interactiveConsent: true });
        return () => { this.setState({ selectedBlock: name != this.state.selectedBlock ? name : undefined }) };
    }

    protected getBlockDragStartHandler = (block: toolbox.BlockDefinition, snippet: string, color: string) => {
        return (e: any) => {
            this.dragInfo = {
                x: pxt.BrowserUtils.getPageX(e),
                y: pxt.BrowserUtils.getPageY(e),
                block,
                snippet,
                color
            };
        }
    }

    protected blockDragHandler =  (e: any) => {
        if (this.dragInfo && (Math.abs(this.dragInfo.x - pxt.BrowserUtils.getPageX(e)) > DRAG_THRESHOLD
            || Math.abs(this.dragInfo.y - pxt.BrowserUtils.getPageY(e)) > DRAG_THRESHOLD)) {
            pxt.tickEvent("monaco.toolbox.itemdrag", undefined, { interactiveConsent: true });
            e.preventDefault();
            e.stopPropagation();

            const block = this.dragInfo.block;
            const params = block.parameters;
            let dragBlock = document.getElementById("monacoDraggingBlock");
            this.dragging = true;
            if (!dragBlock) {
                const parent = document.getElementById("root");
                dragBlock = document.createElement("div");
                dragBlock.id = "monacoDraggingBlock";
                dragBlock.textContent = block.snippetOnly
                    ? block.snippet
                    : `${block.qName || this.getSnippetName(block)}${params ? `(${params.map(p => p.name).join(", ")})` : ""}`
                dragBlock.style.backgroundColor = this.dragInfo.color;
                parent.appendChild(dragBlock);

                // Fire a create event
                workspace.fireEvent({ type: 'create', editor: 'ts', blockId: block.attributes.blockId } as pxt.editor.events.CreateEvent);
                let inline = "";
                if (block.retType != "void") {
                    inline = "inline:1&";
                }
                this.props.setInsertionSnippet(this.dragInfo.snippet || inline + "qName:" + block.qName);
            }
            dragBlock.style.top = `${pxt.BrowserUtils.getPageY(e)}px`;
            dragBlock.style.left = `${pxt.BrowserUtils.getPageX(e)}px`;
        }
    }

    protected blockDragEndHandler = (e: any) => {
        this.dragInfo = undefined;
        this.dragging = false;
        this.props.setInsertionSnippet(undefined);
        const block = document.getElementById("monacoDraggingBlock");
        if (block) block.remove();
    }

    protected getKeyDownHandler = (block?: toolbox.BlockDefinition, snippet?: string, isPython?: boolean) => {
        return (e: any) => {
            const isRtl = pxt.Util.isUserLanguageRtl();
            const charCode = core.keyCodeFromEvent(e);
            const target = e.target as HTMLElement;
            if (charCode == 40) { //  DOWN
                // Next item
                let nextSibling = target.nextElementSibling as HTMLElement;
                if (target && nextSibling) {
                    nextSibling.click();
                    nextSibling.focus();
                }
            } else if (charCode == 38) { // UP
                // Previous item
                let prevSibling = target.previousElementSibling as HTMLElement;
                if (target && prevSibling) {
                    prevSibling.click();
                    prevSibling.focus();
                }
            } else if ((charCode == 37 && !isRtl) || (charCode == 38 && isRtl)) { // (LEFT & LTR) or (RIGHT & RTL)
                // Focus back to toolbox
                this.props.moveFocusToParent();
            } else if (charCode == 27) { // ESCAPE
                // Focus back to toolbox and close Flyout
                this.setState( { groups: undefined });
                this.props.moveFocusToParent();
            } else if (charCode == 13 && block) { // ENTER
                let p = snippet ? Promise.resolve(snippet) : compiler.snippetAsync(block.qName, isPython);
                p.done(snip => {
                    this.props.insertSnippet(null, snip, block.retType != "void");
                    // Fire a create event
                    workspace.fireEvent({ type: 'create', editor: 'ts', blockId: block.attributes.blockId } as pxt.editor.events.CreateEvent);
                });
            }
        }
    }

    protected getHelpButtonClickHandler = (group?: string) => {
        return () => {
            pxt.debug(`${group} help icon clicked.`);
            workspace.fireEvent({ type: 'ui', editor: 'ts', action: 'groupHelpClicked', data: { group } } as pxt.editor.events.UIEvent);
        }
    }

    protected wheelHandler = (evt: any) => {
        evt.stopPropagation();
    }

    protected scrollHandler = (evt:  any) => {
        this.positionDragHandle();
    }

    protected getFlyoutStyle = () => {
        return {
            display: (this.state && this.state.groups) ? "block" : "none"
        }
    }

    protected getIconStyle = (color: string) => {
        return { color };
    }

    protected getSelectedStyle = (selected: boolean, color: string) => {
        return { touchAction: (window as any).PointerEvent ? "none"  : undefined };
    }

    protected getBlockStyle = (color: string) => {
        return {
            backgroundColor: color,
            fontSize: `${this.props.parent.settings.editorFontSize}px`,
            lineHeight: `${this.props.parent.settings.editorFontSize + 1}px`
        };
    }

    protected getSnippetName(block: toolbox.BlockDefinition): string {
        const isPython = this.props.fileType == pxt.editor.FileType.Python;
        return (isPython ? (block.pySnippetName || block.pyName) : undefined) || block.snippetName || block.name;
    }

    protected positionDragHandle(): void {
        let handle = document.querySelector(".monacoBlock.expand .blockHandle") as HTMLDivElement;
        if (handle) {
            let parent = handle.parentElement;
            let container = document.getElementById("monacoFlyoutWrapper");
            handle.style.height = `${parent.clientHeight + (SELECTED_BORDER_WIDTH * 2)}px`;
            handle.style.left = `${parent.clientWidth + SELECTED_BORDER_WIDTH - 1}px`;
            handle.style.top = `${parent.offsetTop - container.scrollTop}px`;
        }
    }

    protected getMonacoBlock(block: toolbox.BlockDefinition, index: number, color: string): JSX.Element {
        if (block.snippet === undefined) return undefined;

        // Get block state (Visible, Hidden, Disabled)
        const { ns } = this.state;
        const filters = this.props.parent.state.editorState ? this.props.parent.state.editorState.filters : undefined;
        const categoryState = filters ? (filters.namespaces && filters.namespaces[ns] != undefined ? filters.namespaces[ns] : filters.defaultState) : undefined;
        const mappedId = this.props.blockIdMap && this.props.blockIdMap[block.attributes.blockId];

        let fnState = filters ? filters.defaultState : pxt.editor.FilterState.Visible;
        if (filters && filters.fns && filters.fns[block.name] !== undefined) {
            fnState = filters.fns[block.name];
        } else if (filters && filters.blocks && block.attributes.blockId &&
            (filters.blocks[block.attributes.blockId] !== undefined || filters.blocks[mappedId] !== undefined)) {
            fnState = filters.blocks[block.attributes.blockId];
        } else if (categoryState !== undefined) {
            fnState = categoryState;
        }
        if (fnState == pxt.editor.FilterState.Hidden) return undefined;

        // Get block DOM element
        const disabled = fnState == pxt.editor.FilterState.Disabled;
        const isPython = this.props.fileType == pxt.editor.FileType.Python;

        const snippetName = this.getSnippetName(block);
        const snippet = isPython ? block.pySnippet : block.snippet;
        const params = block.parameters;
        const blockColor = block.attributes.color || color;

        const qName =  block.qName || block.name;
        const selected = qName == this.state.selectedBlock;

        const hasPointer = (window as any).PointerEvent;
        const hasTouch = pxt.BrowserUtils.isTouchEnabled();
        const dragStartHandler = this.getBlockDragStartHandler(block, snippet, blockColor);

        return <div className={`monacoBlock ${disabled ? "monacoDisabledBlock" : ""} ${selected ? "expand" : ""}`}
                    style={this.getSelectedStyle(selected, blockColor)}
                    title={block.attributes.jsDoc}
                    key={`block_${index}`} tabIndex={0} role="listitem"
                    onClick={this.getBlockClickHandler(qName)}
                    onKeyDown={this.getKeyDownHandler(block, snippet, isPython)}
                    onPointerDown={hasPointer ? dragStartHandler : undefined}
                    onMouseDown={!hasPointer ? dragStartHandler : undefined}
                    onTouchStart={!hasPointer && hasTouch ? dragStartHandler : undefined}>
                <div className="blockHandle" style={this.getSelectedStyle(selected, blockColor)}><i className="icon bars" /></div>
                <div className="monacoDraggableBlock" style={this.getBlockStyle(blockColor)}>
                    <span className="blockName">{block.snippetOnly ? snippet : snippetName}</span>
                    {!block.snippetOnly && params && <span>{`(${params.map(p => p.name).join(", ")})`}</span>}
                </div>
                <div className="detail">
                    <div className="description">{block.attributes.jsDoc}</div>
                    {params && <div className="params">
                        {params.map((p, i) => {
                            return <div key={i}>
                                <div className="separator"></div>
                                <span className="paramName">{p.name}</span>
                                {p.description && <span className="paramDescription">{p.description}</span>}
                            </div>
                        })}
                    </div>}
                </div>
            </div>
    }

    render() {
        const { name, ns, color, icon, groups } = this.state;
        const rgb = pxt.toolbox.convertColor(color || (ns && pxt.toolbox.getNamespaceColor(ns)) || "255");
        const iconClass = `blocklyTreeIcon${icon ? (ns || icon).toLowerCase() : "Default"}`.replace(/\s/g, "");
        return <div id="monacoFlyoutWidget" className="monacoFlyout" style={this.getFlyoutStyle()}>
           <div id="monacoFlyoutWrapper" onScroll={this.scrollHandler} onWheel={this.wheelHandler} role="list">
               <div className="monacoFlyoutLabel monacoFlyoutHeading">
                    <span className={`monacoFlyoutHeadingIcon blocklyTreeIcon ${iconClass}`} role="presentation" style={this.getIconStyle(rgb)}>
                        {(icon && icon.length === 1) ? icon : ""}
                    </span>
                    <div className="monacoFlyoutLabelText">{name}</div>
               </div>
               {groups && groups.map((g, i) => {
                    let group: JSX.Element[] = [];
                    // Add group label, for non-default groups
                    if (g.name != pxt.DEFAULT_GROUP_NAME && groups.length > 1) {
                        group.push(
                            <div className="monacoFlyoutLabel blocklyFlyoutGroup" key={`label_${i}`} tabIndex={0} onKeyDown={this.getKeyDownHandler()} role="separator">
                                {g.icon && <span className={`monacoFlyoutHeadingIcon blocklyTreeIcon ${iconClass}`} role="presentation">{g.icon}</span>}
                                <div className="monacoFlyoutLabelText">{g.name}</div>
                                {g.hasHelp && pxt.editor.HELP_IMAGE_URI && <span>
                                    <img src={pxt.editor.HELP_IMAGE_URI} onClick={this.getHelpButtonClickHandler(g.name)} alt={lf("Click for help")}>
                                </img></span>}
                                <hr className="monacoFlyoutLabelLine" />
                            </div>)
                    }
                    // Add group blocks
                    if (g.blocks) {
                        let blocks = g.blocks.map((b, j) => {
                            // Check if the block is built in, ignore it as it's already defined in snippets
                            if (b.attributes.blockBuiltin) {
                                pxt.log("ignoring built in block: " + b.attributes.blockId);
                                return undefined;
                            } else {
                                return this.getMonacoBlock(b, j, rgb);
                            }
                        }).filter(b => b !== undefined);
                        if (blocks && blocks.length > 0) {
                            group = group.concat(blocks);
                        } else {
                            return null;
                        }
                    }
                   return group;
               })}
           </div>
        </div>
    }
}