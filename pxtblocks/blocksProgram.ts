import * as Blockly from "blockly";
import { clearWithoutEvents, domToWorkspaceNoEvents, loadWorkspaceXml } from "./importer";
import { FunctionDefinitionBlock, isDefinitionBlock } from "./plugins/functions";
import { mutateCallersAndDefinition, getDefinition } from "./plugins/functions/utils";

export const EXPORTED_VARIABLE_TYPE = "makecode_exported";
export const IMPORTED_VARIABLE_TYPE = "makecode_imported";
export const IMPORTED_FUNCTION_TYPE = "makecode_imported_function";

interface BlocksSymbolBase {
    name: string;
    file: string;
    id: string;
}

export interface BlocksVariableSymbol extends BlocksSymbolBase {
    type: "variable";
}

export interface BlocksFunctionSymbol extends BlocksSymbolBase {
    type: "function";
    arguments: BlocksFunctionArgument[];
    hasReturn?: boolean;
}

export interface BlocksEnumKindSymbol extends BlocksSymbolBase {
    type: "enumKind";
    enumName: string;
}

export interface BlockKindSymbol extends BlocksSymbolBase {
    type: "kind";
    enumName: string;
}

export interface BlocksFunctionArgument {
    name: string;
    type: string;
    id: string;
}

export type BlocksSymbol = BlocksVariableSymbol | BlocksFunctionSymbol | BlocksEnumKindSymbol | BlockKindSymbol;

interface FileWorkspace {
    fileName: string;
    workspace: Blockly.Workspace;
}

export interface BlocksProgramHost {
    listFiles(): string[];
    getFile(fileName: string): string;
    saveFile(fileName: string, content: string): void;
}

export interface BlocksProgram {
    listFiles(): string[];
    getSymbolsForFile(fileName: string): BlocksSymbol[];
    renameVariable(symbol: BlocksVariableSymbol, newName: string): void;
    deleteSymbol(symbol: BlocksSymbol): void;
    getAllWorkspaces(): FileWorkspace[];
    getEnumInfo(enumName: string): string[];
    getKindInfo(kindName: string): string[];
    getVariableQualifiedName(varName: string, workspace: Blockly.Workspace): string;
    refreshSymbols?(): void;
    getVariableSymbol(varId: string): BlocksVariableSymbol;
}


export class SingleWorkspaceBlocksProgram implements BlocksProgram {
    constructor(public workspace: Blockly.Workspace) {
    }

    listFiles(): string[] {
        return ["main.blocks"];
    }

    getSymbolsForFile(fileName: string): BlocksSymbol[] {
        const result: BlocksSymbol[] = [];
        result.push(...getVariableSymbols({ fileName, workspace: this.workspace }));
        result.push(...getFunctionSymbols({ fileName, workspace: this.workspace }));
        result.push(...getKindSymbols({ fileName, workspace: this.workspace }));
        return result;
    }

    renameVariable(symbol: BlocksVariableSymbol, newName: string) {
        const variable = this.workspace.getVariableMap().getVariableById(symbol.id);
        if (variable) {
            this.workspace.getVariableMap().renameVariable(variable, newName);
        }
        symbol.name = newName;
    }

    deleteSymbol(symbol: BlocksSymbol) {
        const variable = this.workspace.getVariableMap().getVariableById(symbol.id);
        if (variable) {
            this.workspace.getVariableMap().deleteVariable(variable);
        }

        if (symbol.type === "function") {
            const def = getDefinition(symbol.name, this.workspace);
            if (def) {
                def.dispose();
            }
        }
    }

    getAllWorkspaces(): FileWorkspace[] {
        return [{ fileName: "main.blocks", workspace: this.workspace }];
    }

    getEnumInfo(enumName: string): string[] {
        return getKindSymbols({ fileName: "main.blocks", workspace: this.workspace })
            .filter(k => k.enumName === enumName)
            .map(k => k.name);
    }

    getKindInfo(kindName: string): string[] {
        return getKindSymbols({ fileName: "main.blocks", workspace: this.workspace })
            .filter(k => k.enumName === kindName)
            .map(k => k.name);
    }

    getVariableQualifiedName(varName: string, workspace: Blockly.Workspace): string {
        return varName;
    }

    getVariableSymbol(varId: string): BlocksVariableSymbol {
        const variable = this.workspace.getVariableMap().getVariableById(varId);
        if (variable) {
            return {
                type: "variable",
                name: variable.getName(),
                id: variable.getId(),
                file: "main.blocks"
            };
        }
        return null;
    }
}


export class MultiWorkspaceBlocksProgram implements BlocksProgram {
    protected workspaces: Map<string, FileWorkspace> = new Map();
    protected symbolsCache: Map<string, BlocksSymbol[]> = new Map();

    public currentlyLoadedFile: string;

    constructor(protected mainPackage: BlocksProgramHost, public mainWorkspace: Blockly.Workspace) {
    }

    listFiles(): string[] {
        return this.mainPackage.listFiles().filter(f => f.endsWith(".blocks"));
    }

    getSymbolsForFile(fileName: string): BlocksSymbol[] {
        if (this.symbolsCache.has(fileName)) {
            return this.symbolsCache.get(fileName);
        }

        const workspace = this.loadOrGetWorkspace(fileName);

        const result: BlocksSymbol[] = [];
        result.push(...getVariableSymbols(workspace));
        result.push(...getFunctionSymbols(workspace));
        result.push(...getKindSymbols(workspace));

        this.symbolsCache.set(fileName, result);

        return result;
    }

    renameVariable(symbol: BlocksVariableSymbol, newName: string) {
        const workspace = this.loadOrGetWorkspace(symbol.file).workspace;
        const variable = workspace.getVariableMap().getVariableById(symbol.id);
        if (variable) {
            workspace.getVariableMap().renameVariable(variable, newName);
        }

        symbol.name = newName;
        this.defineSymbolInAllWorkspaces(symbol);
    }

    deleteSymbol(symbol: BlocksSymbol) {
        const workspace = this.loadOrGetWorkspace(symbol.file).workspace;
        const variable = workspace.getVariableMap().getVariableById(symbol.id);
        if (variable) {
            workspace.getVariableMap().deleteVariable(variable);
        }

        if (symbol.type === "function") {
            const def = getDefinition(symbol.name, workspace);
            if (def) {
                def.dispose();
            }
        }

        this.deleteSymbolFromAllWorkspaces(symbol);

        this.symbolsCache.delete(symbol.file);
        this.refreshSymbols();
    }

    getAllWorkspaces(): FileWorkspace[] {
        return Array.from(this.workspaces.values());
    }

    getEnumInfo(enumName: string): string[] {
        const enumValues: string[] = [];

        for (const symbols of this.symbolsCache.values()) {
            for (const symbol of symbols) {
                if (symbol.type === "enumKind" && symbol.enumName === enumName) {
                    if (enumValues.includes(symbol.name)) {
                        continue;
                    }
                    enumValues.push(symbol.name);
                }
            }
        }

        return enumValues;
    }

    getKindInfo(kindName: string): string[] {
        const kindValues: string[] = [];

        for (const symbols of this.symbolsCache.values()) {
            for (const symbol of symbols) {
                if (symbol.type === "kind" && symbol.enumName === kindName) {
                    if (kindValues.includes(symbol.name)) {
                        continue;
                    }
                    kindValues.push(symbol.name);
                }
            }
        }

        return kindValues;
    }

    refreshSymbols() {
        this.symbolsCache.clear();
        for (const fileName of this.listFiles()) {
            this.getSymbolsForFile(fileName);
        }

        for (const symbols of this.symbolsCache.values()) {
            for (const symbol of symbols) {
                this.defineSymbolInAllWorkspaces(symbol);
            }
        }
    }

    loadIntoWorkspaceSvg(file: string) {
        if (this.currentlyLoadedFile) {
            if (this.workspaces.has(this.currentlyLoadedFile)) {
                this.workspaces.delete(this.currentlyLoadedFile);
            }
            this.loadOrGetWorkspace(this.currentlyLoadedFile);
        }

        if (this.workspaces.has(file)) {
            const ws = this.workspaces.get(file);
            if (!(ws.workspace === this.mainWorkspace)) {
                ws.workspace.dispose();
            }
            this.workspaces.delete(file);
        }

        clearWithoutEvents(this.mainWorkspace);

        const fileContents = this.mainPackage.getFile(file);
        const xml = Blockly.utils.xml.textToDom(fileContents);
        xml.querySelectorAll("block[deletable], shadow[deletable]").forEach(b => { b.removeAttribute("deletable") });
        domToWorkspaceNoEvents(xml, this.mainWorkspace);

        this.currentlyLoadedFile = file;
        this.workspaces.set(file, {
            fileName: file,
            workspace: this.mainWorkspace
        });

        this.refreshSymbols();
    }

    unloadWorkspaceSvg() {
        if (this.currentlyLoadedFile) {
            if (this.workspaces.has(this.currentlyLoadedFile)) {
                this.workspaces.delete(this.currentlyLoadedFile);
            }
            this.loadOrGetWorkspace(this.currentlyLoadedFile);
        }

        clearWithoutEvents(this.mainWorkspace);
        this.currentlyLoadedFile = null;
    }

    getVariableQualifiedName(varName: string, workspace: Blockly.Workspace): string {
        const map = workspace.getVariableMap();
        let variable = map.getVariable(varName);
        if (!variable) {
            variable = map.getVariable(varName, IMPORTED_VARIABLE_TYPE);
        }

        if (variable?.getType() === IMPORTED_VARIABLE_TYPE) {
            for (const symbols of this.symbolsCache.values()) {
                for (const symbol of symbols) {
                    if (symbol.type === "variable" && symbol.id === variable.getId()) {
                        return `${getNamespaceFromFilename(symbol.file)}.${symbol.name}`;
                    }
                }
            }
        }
        else {
            for (const fileWorkspace of this.workspaces.values()) {
                if (fileWorkspace.workspace === workspace) {
                    return `${getNamespaceFromFilename(fileWorkspace.fileName)}.${varName}`;
                }
            }
        }
        throw new Error(`Variable ${varName} not found in any workspace`);
    }

    getVariableSymbol(varId: string): BlocksVariableSymbol {
        for (const symbols of this.symbolsCache.values()) {
            for (const symbol of symbols) {
                if (symbol.type === "variable" && symbol.id === varId) {
                    return symbol;
                }
            }
        }
        return null;
    }

    protected defineSymbolInWorkspace(symbol: BlocksSymbol, workspace: Blockly.Workspace) {
        const map = workspace.getVariableMap();

        const varId = symbol.id;
        let varName = symbol.name;
        let varType: string | undefined = undefined;

        if (symbol.type === "variable") {
            varType = IMPORTED_VARIABLE_TYPE;
        }
        else if (symbol.type === "function") {
            // obviously this is not great, but blockly doesn't have a way to store
            // more complex data types on variables when using XML serialization, which we are unfortunately
            // stuck with for now
            varType = IMPORTED_FUNCTION_TYPE;
            varName = JSON.stringify(symbol);
        }
        else if (symbol.type === "kind") {
            varType = `KIND_${symbol.enumName}`;
        }
        else if (symbol.type === "enumKind") {
            varType = symbol.enumName;
        }

        const existingVariable = map.getVariableById(varId);
        if (existingVariable) {
            if (existingVariable.getType() !== varType) {
                // FIXME: this is super unlikely to happen, but if it does we should probably do something better than just throwing an error
                throw new Error(`Variable with id ${varId} already exists with different type`);
            }

            if (existingVariable.getName() !== varName) {
                const oldName = existingVariable.getName();
                map.renameVariable(existingVariable, varName);

                if (symbol.type === "function") {
                    const oldMutation = generateFunctionMutationFromSymbol(JSON.parse(oldName) as BlocksFunctionSymbol);
                    const newMutation = generateFunctionMutationFromSymbol(symbol as BlocksFunctionSymbol);

                    mutateCallersAndDefinition(symbol.name, workspace, oldMutation, newMutation);
                }
            }
        }
        else {
            map.createVariable(varName, varType, varId);
        }
    }

    protected deleteSymbolFromWorkspace(symbol: BlocksSymbol, workspace: Blockly.Workspace) {
        const map = workspace.getVariableMap();
        const variable = map.getVariableById(symbol.id);
        if (variable) {
            map.deleteVariable(variable);
        }
    }

    protected defineSymbolInAllWorkspaces(symbol: BlocksSymbol) {
        for (const workspace of this.workspaces.values()) {
            if (workspace.fileName === symbol.file) {
                continue;
            }
            this.defineSymbolInWorkspace(symbol, workspace.workspace);
        }
    }

    protected deleteSymbolFromAllWorkspaces(symbol: BlocksSymbol) {
        for (const workspace of this.workspaces.values()) {
            if (workspace.fileName === symbol.file) {
                continue;
            }
            this.deleteSymbolFromWorkspace(symbol, workspace.workspace);
        }
    }

    protected loadOrGetWorkspace(fileName: string): FileWorkspace {
        if (this.workspaces.has(fileName)) {
            return this.workspaces.get(fileName);
        }

        const fileText = this.mainPackage.getFile(fileName);

        const workspace = {
            fileName,
            workspace: loadWorkspaceXml(fileText)
        };

        this.workspaces.set(fileName, workspace);
        return workspace;
    }
}

function getVariableSymbols(workspace: FileWorkspace): BlocksVariableSymbol[] {
    const map = workspace.workspace.getVariableMap();

    return map.getVariablesOfType(EXPORTED_VARIABLE_TYPE).map(v => ({
        type: "variable",
        name: v.getName(),
        id: v.getId(),
        file: workspace.fileName
    }));
}

function getFunctionSymbols(workspace: FileWorkspace): BlocksFunctionSymbol[] {
    const topBlocks = workspace.workspace.getTopBlocks(false);
    const symbols: BlocksFunctionSymbol[] = [];

    for (const block of topBlocks) {
        if (isDefinitionBlock(block)) {
            symbols.push(getSymbolFromFunctionDefinitionBlock(block, workspace.fileName));
        }
    }

    return symbols;
}

function getSymbolFromFunctionDefinitionBlock(block: FunctionDefinitionBlock, fileName: string): BlocksFunctionSymbol {
    const mutation = block.mutationToDom();
    const functionSymbol: BlocksFunctionSymbol = {
        type: "function",
        id: mutation.getAttribute("functionid"),
        name: mutation.getAttribute("name"),
        arguments: [],
        hasReturn: block.getDescendants(false).some(child => child.type === "function_return" && child.getInputTargetBlock("RETURN_VALUE")),
        file: fileName,
    };

    for (const child of mutation.children) {
        if (child.tagName === "arg") {
            functionSymbol.arguments.push({
                name: child.getAttribute("name"),
                type: child.getAttribute("type"),
                id: child.getAttribute("argid")
            });
        }
    }

    return functionSymbol;
}

export function generateFunctionMutationFromSymbol(symbol: BlocksFunctionSymbol): Element {
    const mutation = document.createElement("mutation");
    mutation.setAttribute("functionid", symbol.id);
    mutation.setAttribute("name", symbol.name);
    for (const arg of symbol.arguments) {
        const argElement = document.createElement("arg");
        argElement.setAttribute("name", arg.name);
        argElement.setAttribute("type", arg.type);
        argElement.setAttribute("id", arg.id);
        mutation.appendChild(argElement);
    }
    return mutation;
}


function getKindSymbols(workspace: FileWorkspace): (BlockKindSymbol | BlocksEnumKindSymbol)[] {
    const map = workspace.workspace.getVariableMap();
    const allVariables = map.getAllVariables();

    const enumKindSymbols: (BlockKindSymbol | BlocksEnumKindSymbol)[] = [];

    for (const variable of allVariables) {
        const varType = variable.getType();
        if (varType?.startsWith("KIND_")) {
            enumKindSymbols.push({
                type: "kind",
                name: variable.getName(),
                id: variable.getId(),
                file: workspace.fileName,
                enumName: varType.substring("KIND_".length)
            });
        }
        else if (varType === IMPORTED_FUNCTION_TYPE || varType === IMPORTED_VARIABLE_TYPE || varType === EXPORTED_VARIABLE_TYPE) {
            continue;
        }
        else if (varType) {
            const name = variable.getName();
            if (/^(\d+)([^0-9].*)$/.test(name)) {
                enumKindSymbols.push({
                    type: "enumKind",
                    name: name,
                    id: variable.getId(),
                    file: workspace.fileName,
                    enumName: varType
                });
            }
        }
    }

    return enumKindSymbols;
}

function getNamespaceFromFilename(name: string) {
    name = name.replace(/\.blocks$/i, "");

    name = name.replace(".", "dot");
    name = name.replace(" ", "_");
    name = name.replace("-", "dash");

    name = name.replace(/^[^a-zA-Z_]+/, "");

    return "_" + name;
}