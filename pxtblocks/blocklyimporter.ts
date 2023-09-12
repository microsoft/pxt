///<reference path='../localtypings/pxtblockly.d.ts'/>
/// <reference path="../built/pxtlib.d.ts" />

namespace pxt.blocks {
    export interface BlockSnippet {
        target: string; // pxt.appTarget.id
        versions: pxt.TargetVersions;
        xml: string[]; // xml for each top level block
        extensions?: string[]; // currently unpopulated. list of extensions used in screenshotted projects
    }

    export interface DomToWorkspaceOptions {
        applyHideMetaComment?: boolean;
        keepMetaComments?: boolean;
    }

    /**
     * Converts a DOM into workspace without triggering any Blockly event. Returns the new block ids
     * @param dom
     * @param workspace
     */
    export function domToWorkspaceNoEvents(dom: Element, workspace: Blockly.Workspace, opts?: DomToWorkspaceOptions): string[] {
        pxt.tickEvent(`blocks.domtow`)
        let newBlockIds: string[] = [];
        try {
            Blockly.Events.disable();
            newBlockIds = Blockly.Xml.domToWorkspace(dom, workspace);
            applyMetaComments(workspace, opts);
        } catch (e) {
            pxt.reportException(e);
        } finally {
            Blockly.Events.enable();
        }
        return newBlockIds.filter(id => !!workspace.getBlockById(id));
    }

    function applyMetaComments(workspace: Blockly.Workspace, opts?: DomToWorkspaceOptions) {
        // process meta comments
        // @highlight -> highlight block
        workspace.getAllBlocks(false)
            .filter(b => !!b.getCommentText())
            .forEach(b => {
                const initialCommentText = b.getCommentText();
                if (/@hide/.test(initialCommentText) && opts?.applyHideMetaComment) {
                    b.dispose(true);
                    return;
                }

                let newCommentText = initialCommentText;
                if (/@highlight/.test(newCommentText)) {
                    newCommentText = newCommentText.replace(/@highlight/g, '').trim();
                    (workspace as Blockly.WorkspaceSvg).highlightBlock?.(b.id, true)
                }
                if (/@collapsed/.test(newCommentText) && !b.getParent()) {
                    newCommentText = newCommentText.replace(/@collapsed/g, '').trim();
                    b.setCollapsed(true);
                }
                newCommentText = newCommentText.replace(/@validate-\S+/g, '').trim();

                if (initialCommentText !== newCommentText && !opts?.keepMetaComments) {
                    b.setCommentText(newCommentText || null);
                }
            });
    }

    export function clearWithoutEvents(workspace: Blockly.Workspace) {
        pxt.tickEvent(`blocks.clear`)
        if (!workspace) return;
        try {
            Blockly.Events.disable();
            workspace.clear();
            workspace.clearUndo();
        } finally {
            Blockly.Events.enable();
        }
    }

    // Saves entire workspace, including variables, into an xml string
    export function saveWorkspaceXml(ws: Blockly.Workspace, keepIds?: boolean): string {
        const xml = Blockly.Xml.workspaceToDom(ws, !keepIds);
        const text = Blockly.Xml.domToText(xml);
        return text;
    }

    // Saves only the blocks xml by iterating over the top blocks
    export function saveBlocksXml(ws: Blockly.Workspace, keepIds?: boolean): string[] {
        let topBlocks = ws.getTopBlocks(false);
        return topBlocks.map(block => {
            return Blockly.Xml.domToText(Blockly.Xml.blockToDom(block, !keepIds));
        });
    }

    export function getDirectChildren(parent: Element, tag: string) {
        const res: Element[] = [];
        for (let i = 0; i < parent.childNodes.length; i++) {
            const n = parent.childNodes.item(i) as Element;
            if (n.tagName === tag) {
                res.push(n);
            }
        }
        return res;
    }

    export function getBlocksWithType(parent: Document | Element, type: string) {
        return getChildrenWithAttr(parent, "block", "type", type).concat(getChildrenWithAttr(parent, "shadow", "type", type));
    }

    export function getChildrenWithAttr(parent: Document | Element, tag: string, attr: string, value: string) {
        return Util.toArray(parent.getElementsByTagName(tag)).filter(b => b.getAttribute(attr) === value);
    }

    export function getFirstChildWithAttr(parent: Document | Element, tag: string, attr: string, value: string) {
        const res = getChildrenWithAttr(parent, tag, attr, value);
        return res.length ? res[0] : undefined;
    }

    export function loadBlocksXml(ws: Blockly.WorkspaceSvg, text: string) {
        let xmlBlock = Blockly.Xml.textToDom(text);
        let block = Blockly.Xml.domToBlock(xmlBlock, ws) as Blockly.BlockSvg;
        if (ws.getMetrics) {
            let metrics = ws.getMetrics();
            let blockDimensions = block.getHeightWidth();
            block.moveBy(
              metrics.viewLeft + (metrics.viewWidth / 2) - (blockDimensions.width / 2),
              metrics.viewTop + (metrics.viewHeight / 2) - (blockDimensions.height / 2)
            );
        }
    }

    /**
     * Loads the xml into a off-screen workspace (not suitable for size computations)
     */
    export function loadWorkspaceXml(xml: string, skipReport = false, opts?: DomToWorkspaceOptions): Blockly.Workspace {
        const workspace = new Blockly.Workspace() as Blockly.WorkspaceSvg;
        try {
            const dom = Blockly.Xml.textToDom(xml);
            pxt.blocks.domToWorkspaceNoEvents(dom, workspace, opts);
            return workspace;
        } catch (e) {
            if (!skipReport)
                pxt.reportException(e);
            return null;
        }
    }

    function patchFloatingBlocks(dom: Element, info: pxtc.BlocksInfo) {
        const onstarts = getBlocksWithType(dom, ts.pxtc.ON_START_TYPE);
        let onstart = onstarts.length ? onstarts[0] : undefined;
        if (onstart) { // nothing to do
            onstart.removeAttribute("deletable");
            return;
        }

        let newnodes: Element[] = [];

        const blocks: Map<pxtc.SymbolInfo> = info.blocksById;

        // walk top level blocks
        let node = dom.firstElementChild;
        let insertNode: Element = undefined;
        while (node) {
            const nextNode = node.nextElementSibling;
            // does this block is disable or have s nested statement block?
            const nodeType = node.getAttribute("type");
            if (!node.getAttribute("disabled") && !node.getElementsByTagName("statement").length
                && (pxt.blocks.buildinBlockStatements[nodeType] ||
                    (blocks[nodeType] && blocks[nodeType].retType == "void" && !hasArrowFunction(blocks[nodeType])))
            ) {
                // old block, needs to be wrapped in onstart
                if (!insertNode) {
                    insertNode = dom.ownerDocument.createElement("statement");
                    insertNode.setAttribute("name", "HANDLER");
                    if (!onstart) {
                        onstart = dom.ownerDocument.createElement("block");
                        onstart.setAttribute("type", ts.pxtc.ON_START_TYPE);
                        newnodes.push(onstart);
                    }
                    onstart.appendChild(insertNode);
                    insertNode.appendChild(node);

                    node.removeAttribute("x");
                    node.removeAttribute("y");
                    insertNode = node;
                } else {
                    // event, add nested statement
                    const next = dom.ownerDocument.createElement("next");
                    next.appendChild(node);
                    insertNode.appendChild(next);
                    node.removeAttribute("x");
                    node.removeAttribute("y");
                    insertNode = node;
                }
            }
            node = nextNode;
        }

        newnodes.forEach(n => dom.appendChild(n));
    }

    /**
     * Patch to transform old function blocks to new ones, and rename child nodes
     */
    function patchFunctionBlocks(dom: Element, info: pxtc.BlocksInfo) {
        let functionNodes = pxt.U.toArray(dom.querySelectorAll("block[type=procedures_defnoreturn]"));
        functionNodes.forEach(node => {
            node.setAttribute("type", "function_definition");
            node.querySelector("field[name=NAME]").setAttribute("name", "function_name");
        })

        let functionCallNodes = pxt.U.toArray(dom.querySelectorAll("block[type=procedures_callnoreturn]"));
        functionCallNodes.forEach(node => {
            node.setAttribute("type", "function_call");
            node.querySelector("field[name=NAME]").setAttribute("name", "function_name");
        })
    }

    /**
     * This callback is populated from the editor extension result.
     * Allows a target to provide version specific blockly updates
     */
    export let extensionBlocklyPatch: (pkgTargetVersion: string, dom: Element) => void;

    export function importXml(pkgTargetVersion: string, xml: string, info: pxtc.BlocksInfo, skipReport = false): string {
        try {
            // If it's the first project we're importing in the session, Blockly is not initialized
            // and blocks haven't been injected yet
            pxt.blocks.initializeAndInject(info);

            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, "application/xml");

            const upgrades = pxt.patching.computePatches(pkgTargetVersion);
            if (upgrades) {
                // patch block types
                upgrades.filter(up => up.type == "blockId")
                    .forEach(up => Object.keys(up.map).forEach(type => {
                        getBlocksWithType(doc, type)
                            .forEach(blockNode => {
                                blockNode.setAttribute("type", up.map[type]);
                                pxt.debug(`patched block ${type} -> ${up.map[type]}`);
                            });
                    }))

                // patch block value
                upgrades.filter(up => up.type == "blockValue")
                    .forEach(up => Object.keys(up.map).forEach(k => {
                        const m = k.split('.');
                        const type = m[0];
                        const name = m[1];
                        getBlocksWithType(doc, type)
                            .reduce<Element[]>((prev, current) => prev.concat(getDirectChildren(current, "value")), [])
                            .forEach(blockNode => {
                                blockNode.setAttribute("name", up.map[k]);
                                pxt.debug(`patched block value ${k} -> ${up.map[k]}`);
                            });
                    }))

                // patch enum variables
                upgrades.filter(up => up.type == "userenum")
                    .forEach(up => Object.keys(up.map).forEach(k => {
                        getChildrenWithAttr(doc, "variable", "type", k).forEach(el => {
                            el.setAttribute("type", up.map[k]);
                            pxt.debug(`patched enum variable type ${k} -> ${up.map[k]}`);
                        })
                    }));
            }

            // Blockly doesn't allow top-level shadow blocks. We've had bugs in the past where shadow blocks
            // have ended up as top-level blocks, so promote them to regular blocks just in case
            const shadows = getDirectChildren(doc.children.item(0), "shadow");
            for (const shadow of shadows) {
                const block = doc.createElement("block");
                shadow.getAttributeNames().forEach(attr => block.setAttribute(attr, shadow.getAttribute(attr)));
                for (let j = 0; j < shadow.childNodes.length; j++) {
                    block.appendChild(shadow.childNodes.item(j));
                }
                shadow.replaceWith(block);
            }

            // build upgrade map
            const enums: Map<string> = {};
            Object.keys(info.apis.byQName).forEach(k => {
                let api = info.apis.byQName[k];
                if (api.kind == pxtc.SymbolKind.EnumMember)
                    enums[api.namespace + '.' + (api.attributes.blockImportId || api.attributes.block || api.attributes.blockId || api.name)]
                        = api.namespace + '.' + api.name;
            })

            // walk through blocks and patch enums
            const blocks = doc.getElementsByTagName("block");
            for (let i = 0; i < blocks.length; ++i)
                patchBlock(info, enums, blocks[i]);

            // patch floating blocks
            patchFloatingBlocks(doc.documentElement, info);

            // patch function blocks
            patchFunctionBlocks(doc.documentElement, info)

            // apply extension patches
            if (pxt.blocks.extensionBlocklyPatch)
                pxt.blocks.extensionBlocklyPatch(pkgTargetVersion, doc.documentElement);

            // serialize and return
            return new XMLSerializer().serializeToString(doc);
        }
        catch (e) {
            if (!skipReport)
                reportException(e);
            return xml;
        }
    }

    function patchBlock(info: pxtc.BlocksInfo, enums: Map<string>, block: Element): void {
        let type = block.getAttribute("type");
        let b = Blockly.Blocks[type];
        let symbol = blockSymbol(type);
        if (!symbol || !b) return;

        let comp = compileInfo(symbol);
        symbol.parameters?.forEach((p, i) => {
            let ptype = info.apis.byQName[p.type];
            if (ptype && ptype.kind == pxtc.SymbolKind.Enum) {
                let field = getFirstChildWithAttr(block, "field", "name", comp.actualNameToParam[p.name].definitionName);
                if (field) {
                    let en = enums[ptype.name + '.' + field.textContent];
                    if (en) field.textContent = en;
                }
                /*
<block type="device_button_event" x="92" y="77">
    <field name="NAME">Button.AB</field>
  </block>
                  */
            }
        })
    }

    export function validateAllReferencedBlocksExist(xml: string) {
        pxt.U.assert(!!Blockly?.Blocks, "Called validateAllReferencedBlocksExist before initializing Blockly");
        const dom = Blockly.Xml.textToDom(xml);

        const blocks = dom.querySelectorAll("block");

        for (let i = 0; i < blocks.length; i++) {
            if (!Blockly.Blocks[blocks.item(i).getAttribute("type")]) return false;
        }

        const shadows = dom.querySelectorAll("shadow");

        for (let i = 0; i < shadows.length; i++) {
            if (!Blockly.Blocks[shadows.item(i).getAttribute("type")]) return false;
        }

        return true;
    }
}
