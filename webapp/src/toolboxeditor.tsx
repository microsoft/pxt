
import * as srceditor from "./srceditor";
import * as toolbox from "./toolbox";
import * as compiler from "./compiler";

export abstract class ToolboxEditor extends srceditor.Editor {

    protected blockInfo: pxtc.BlocksInfo;
    protected blockGroupsCache: pxt.Map<toolbox.GroupDefinition[]>;
    protected blockIdMap: pxt.Map<string[]>;

    private searchSubset: pxt.Map<boolean | string>;

    protected toolbox: toolbox.Toolbox;
    protected extensions: pxt.Package[];

    abstract getBlocksForCategory(ns: string, subns?: string): toolbox.BlockDefinition[];

    protected shouldShowBlock(blockId: string, ns: string, shadow?: boolean) {
        const filters = this.parent.state.editorState && this.parent.state.editorState.filters;
        if (filters) {
            // block-level filters should not apply to shadow blocks (nested)
            const blockFilter = filters.blocks && (filters.blocks[blockId] || (this.blockIdMap && this.blockIdMap[blockId]?.some(id => filters.blocks[id])));
            const categoryFilter = filters.namespaces && filters.namespaces[ns];
            // First try block filters
            if (blockFilter != undefined && blockFilter == pxt.editor.FilterState.Hidden && !shadow) return false;
            if (blockFilter != undefined) return true;
            // Check if category is hidden
            if (categoryFilter != undefined && categoryFilter == pxt.editor.FilterState.Hidden) return false;
            if (categoryFilter != undefined) return true;
            // Check default filter state
            if (filters.defaultState != undefined && filters.defaultState == pxt.editor.FilterState.Hidden && !shadow) return false;
        }
        return true;
    }

    protected shouldShowCustomCategory(ns: string) {
        const filters = this.parent.state.editorState && this.parent.state.editorState.filters;
        if (filters) {
            // These categories are special and won't have any children so we need to check the filters manually
            if (ns === "variables" && (!filters.blocks ||
                filters.blocks["variables_set"] ||
                filters.blocks["variables_get"] ||
                filters.blocks["variables_change"]) &&
                (!filters.namespaces || filters.namespaces["variables"] !== pxt.editor.FilterState.Disabled)) {
                return true;
            } else if (ns === "functions" && (!filters.blocks ||
                filters.blocks["function_definition"] ||
                filters.blocks["procedures_defnoreturn"] ||
                filters.blocks["procedures_callnoreturn"]) &&
                (!filters.namespaces || filters.namespaces["functions"] !== pxt.editor.FilterState.Disabled)) {
                return true;
            } else {
                return false;
            }
        }
        return true;
    }

    getSearchSubset() {
        if (!this.searchSubset && this.blockInfo) {
            this.searchSubset = {};
            const searchSubset = this.searchSubset;
            // Go through all built in blocks
            let blockDefinitions = pxt.blocks.blockDefinitions();
            for (const id in blockDefinitions) {
                const blockDef = blockDefinitions[id];
                if (this.shouldShowBlock(id, blockDef.category)) {
                    // Add to search subset
                    searchSubset[id] = true;
                }
            }

            // Go through all blocks and apply filter
            this.blockInfo.blocks.forEach(fn => {
                let ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];

                if (fn.attributes.debug && !pxt.options.debug) return;
                if (fn.attributes.deprecated || fn.attributes.blockHidden) return;
                if (this.shouldShowBlock(fn.attributes.blockId, ns)) {
                    // Add to search subset
                    searchSubset[fn.attributes.blockId] = true;
                }
            });
        }
        return this.searchSubset;
    }

    searchAsync(searchTerm: string): Promise<pxtc.service.SearchInfo[]> {
        const searchOptions: pxtc.service.SearchOptions = {
            term: searchTerm,
            subset: this.getSearchSubset()
        };
        return compiler.apiSearchAsync(searchOptions)
            .then((fns: pxtc.service.SearchInfo[]) => fns)
            .then(searchResults => {
                pxt.debug("searching for: " + searchTerm);
                return searchResults;
            });
    }

    clearCaches() {
        super.clearCaches();
        this.searchSubset = undefined;
        this.blockGroupsCache = undefined;
    }

    abstract getBuiltinCategory(ns: string): toolbox.ToolboxCategory;
    abstract isBuiltIn(ns: string): boolean;

    public getAllCategories() {
        return this.getToolboxCategories(false).concat(this.getToolboxCategories(true));
    }

    public getToolboxCategories(isAdvanced?: boolean) {
        if (!this.blockInfo) return [];

        let that = this;

        function filterNamespaces(namespaces: [string, pxtc.CommentAttrs][]) {
            return namespaces.filter(([, md]) => !md.deprecated && (isAdvanced ? md.advanced : !md.advanced));
        }

        const namespaces = filterNamespaces(this.getNamespaces()
            .map(ns => [ns, that.getNamespaceAttrs(ns)] as [string, pxtc.CommentAttrs]));

        function createSubCategories(parent: [string, pxtc.CommentAttrs], names: string[], isAdvanced?: boolean): toolbox.ToolboxCategory[] {
            return names.map(subns => {
                const ns = parent[0];
                const md = parent[1];

                // Don't show subcategory if there are no blocks to show
                const blocks = that.getBlocksForCategory(ns, subns).filter(block => that.shouldShowBlock(block.attributes.blockId, ns));
                if (!blocks.length) return undefined;

                const name = pxt.Util.rlf(`{id:subcategory}${subns}`);
                return {
                    nameid: ns,
                    name,
                    subns: subns,
                    color: md.color,
                    icon: md.icon,
                    groups: md.groups,
                    groupIcons: md.groupIcons,
                    groupHelp: md.groupHelp,
                    labelLineWidth: md.labelLineWidth,
                    blocks: blocks,
                    advanced: isAdvanced
                }
            }).filter(subns => !!subns);
        }

        function createCategories(names: [string, pxtc.CommentAttrs][], isAdvanced?: boolean): toolbox.ToolboxCategory[] {
            return names
                .sort(([, md1], [, md2]) => {
                    // sort by fn weight
                    const w2 = (md2 ? md2.weight || 50 : 50);
                    const w1 = (md1 ? md1.weight || 50 : 50);
                    return w2 >= w1 ? 1 : -1;
                }).map(([ns, md]) => {
                    const isBuiltIn = that.isBuiltIn(ns);
                    const builtInCategory = isBuiltIn ? that.getBuiltinCategory(ns) : undefined;

                    // We need the blocks to figure out if all blocks are hidden
                    const blocks = that.getBlocksForCategory(ns).filter(block => that.shouldShowBlock(block.attributes.blockId, ns));
                    const hasExtensionButtons = that.extensionsMap[ns];
                    const hasCustomClick = builtInCategory && builtInCategory.customClick;

                    let subcategories: toolbox.ToolboxCategory[];

                    if ((md.subcategories && md.subcategories.length) || that.subcategoryMap[ns]) {
                        subcategories = createSubCategories([ns, md], md.subcategories || Object.keys(that.subcategoryMap[ns]), isAdvanced);
                    }

                    const hasBlocks = blocks.length || hasExtensionButtons || hasCustomClick || (subcategories && subcategories.length);
                    // Don't show the category if there are no blocks in it
                    if (!hasBlocks) return undefined;

                    if (hasCustomClick) {
                        // Ensure that we need to show this custom category
                        if (!that.shouldShowCustomCategory(ns)) return undefined;
                    }

                    // Prepare the category
                    let category: toolbox.ToolboxCategory = {
                        nameid: ns,
                        name: md.block ? md.block : undefined,
                        color: md.color,
                        icon: md.icon,
                        groups: md.groups,
                        groupIcons: md.groupIcons,
                        groupHelp: md.groupHelp,
                        labelLineWidth: md.labelLineWidth,
                        blocks: blocks,
                        subcategories: subcategories,
                        advanced: isAdvanced
                    };

                    // Apply specific builtin customizations
                    if (isBuiltIn) {
                        category.name = builtInCategory.name;
                        category.icon = md.icon ? pxt.toolbox.getNamespaceIcon(md.icon)
                            || md.icon : pxt.toolbox.getNamespaceIcon(ns);
                        category.groups = builtInCategory.groups || md.groups;
                        category.customClick = builtInCategory.customClick;
                    }
                    return category;
                }).filter(cat => !!cat);
        }
        return createCategories(namespaces, isAdvanced);
    }

    abstract showFlyout(treeRow: toolbox.ToolboxCategory): void;
    abstract hideFlyout(): void;
    moveFocusToFlyout() { }

    protected abstract showFlyoutHeadingLabel(ns: string, name: string, subns: string, icon: string, color: string): void;
    protected abstract showFlyoutGroupLabel(group: string, groupicon: string, labelLineWidth: string, helpCallback: string): void;
    protected abstract showFlyoutBlocks(ns: string, color: string, blocks: toolbox.BlockDefinition[]): void;

    abstractShowFlyout(treeRow: toolbox.ToolboxCategory): boolean {
        const { nameid: ns, name, subns, icon, color, labelLineWidth, blocks } = treeRow;
        const inTutorial = this.parent.state.tutorialOptions
            && !!this.parent.state.tutorialOptions.tutorial;

        if (!blocks || !blocks.length) return false;

        if (!pxt.appTarget.appTheme.hideFlyoutHeadings) {
            // Add the Heading label
            this.showFlyoutHeadingLabel(ns, name, subns, icon, color);
        }

        // Organize and rearrange methods into groups
        let blockGroups = this.getBlockGroups(treeRow);

        // Add labels and insert the blocks into the flyout
        for (let i = 0; i < blockGroups.length; ++i) {
            let group = blockGroups[i];
            // Check if there are any blocks in that group
            if (!group.blocks || !group.blocks.length) continue;

            // Add the group label
            if (group.name != pxt.DEFAULT_GROUP_NAME && !inTutorial && blockGroups.length != 1) {
                this.showFlyoutGroupLabel(group.name, group.icon, labelLineWidth, group.hasHelp ? "help" : "");
            }

            // Add the blocks in that group
            this.showFlyoutBlocks(ns, color, group.blocks);
        }

        return true;
    }

    protected extensionsMap: pxt.Map<pxt.PackageConfig> = {};
    protected subcategoryMap: pxt.Map<pxt.Map<boolean>> = {};
    protected topBlocks: toolbox.BlockDefinition[] = [];

    // To be extended by editor
    getNamespaceAttrs(ns: string): pxtc.CommentAttrs {
        const info = this.blockInfo.apis.byQName[ns];
        if (info) {
            return info.attributes;
        }

        if (this.extensionsMap[ns]) {
            const config = this.extensionsMap[ns];
            return {
                weight: 0,
                blockId: config.name,
                color: config.extension.color || '#7f8c8d',
                advanced: config.extension.advanced || false,
                callingConvention: ts.pxtc.ir.CallingConvention.Plain,
                paramDefl: {}
            }
        }

        return undefined;
    }

    // To be extended by editor
    getNamespaces() {
        const namespaces: string[] = [];
        // Add extension namespaces if not already in
        this.extensions.forEach(p => {
            const config = p.config;
            const name = config.name;
            const namespace = config.extension.namespace || name;
            if (!this.extensionsMap[namespace]) this.extensionsMap[namespace] = config;
            if (!namespaces.filter(ns => ns == namespace)) {
                namespaces.push(name);
            }
        })
        return namespaces;
    }

    getTopBlocks(): toolbox.BlockDefinition[] {
        // Order top blocks by weight
        return this.topBlocks.sort((fn1, fn2) => {
            // sort by fn weight
            const w1 = fn1.attributes.topblockWeight || fn1.attributes.weight || 50;
            const w2 = fn2.attributes.topblockWeight || fn2.attributes.weight || 50;
            return w2 >= w1 ? 1 : -1;
        });
    }

    getBlockGroups(treeRow: toolbox.ToolboxCategory): toolbox.GroupDefinition[] {
        const ns = treeRow.nameid + (treeRow.subns || "");
        if (!this.blockGroupsCache) this.blockGroupsCache = {}
        if (!this.blockGroupsCache[ns]) {
            const {groups, groupIcons, groupHelp, blocks } = treeRow;

            // Parse full list of groups from block attributes
            let parsedGroups = groups || [];
            blocks.forEach(b => {
                let g = (b.attributes && b.attributes.group) || pxt.DEFAULT_GROUP_NAME;
                if (parsedGroups.indexOf(g) < 0) parsedGroups.push(g);
            })

            // Organize and rearrange methods into groups
            let blockGroups: toolbox.GroupDefinition[] = [];
            if (parsedGroups) {
                for (let i = 0; i < parsedGroups.length; i++) {
                    let name = parsedGroups[i];
                    let groupBlocks =  blocks.filter(b => (b.attributes.group || pxt.DEFAULT_GROUP_NAME) == name)
                    .sort((f1, f2) => {
                        // sort by fn weight
                        const w2 = (f2.attributes.weight || 50) + (f2.attributes.advanced ? 0 : 1000);
                        const w1 = (f1.attributes.weight || 50) + (f1.attributes.advanced ? 0 : 1000);
                        return w2 > w1 ? 1 : -1;
                    })
                    if (groupBlocks && groupBlocks.length > 0) {
                        blockGroups.push({
                            name,
                            icon: (groupIcons && groupIcons[i]) || '',
                            hasHelp: groupHelp && !!groupHelp[i],
                            blocks: groupBlocks
                        });
                    }
                }
            }
            // Only cache if there are no filters
            if (!this.parent.state?.editorState?.filters) {
                this.blockGroupsCache[ns] = blockGroups;
            } else {
                return blockGroups;
            }
        }

        return this.blockGroupsCache[ns];
    }
}