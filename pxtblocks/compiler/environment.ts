/// <reference path="../../built/pxtlib.d.ts" />


import * as Blockly from "blockly";
import { escapeVarName, isFunctionDefinition } from "./util";

export interface Environment {
    workspace: Blockly.Workspace;
    options: BlockCompileOptions;
    stdCallTable: pxt.Map<StdFunc>;
    userFunctionReturnValues: pxt.Map<Point>;
    diagnostics: BlockDiagnostic[];
    errors: Blockly.Block[];
    renames: RenameMap;
    stats: pxt.Map<number>;
    enums: pxtc.EnumInfo[];
    kinds: pxtc.KindInfo[];
    idToScope: pxt.Map<Scope>;
    blockDeclarations: pxt.Map<VarInfo[]>;
    blocksInfo: pxtc.BlocksInfo;
    allVariables: VarInfo[];
    placeholders: pxt.Map<pxt.Map<PlaceholderLikeBlock>>;
}

// A description of each function from the "device library". Types are fetched
// from the Blockly blocks definition.
// - the key is the name of the Blockly.Block that we compile into a device call;
// - [f] is the TouchDevelop function name we compile to
// - [args] is a list of names; the name is taken to be either the name of a
//   Blockly field value or, if not found, the name of a Blockly input block; if a
//   field value is found, then this generates a string expression. If argument is a literal, simply emits the literal.
// - [isExtensionMethod] is a flag so that instead of generating a TouchDevelop
//   call like [f(x, y...)], we generate the more "natural" [x → f (y...)]
// - [namespace] is also an optional flag to generate a "namespace" call, that
//   is, "basic -> show image" instead of "micro:bit -> show image".
export interface StdFunc {
    f: string;
    comp: pxt.blocks.BlockCompileInfo;
    attrs: ts.pxtc.CommentAttrs;
    isExtensionMethod?: boolean;
    isExpression?: boolean;
    imageLiteral?: number;
    imageLiteralColumns?: number;
    imageLiteralRows?: number;
    hasHandler?: boolean;
    property?: boolean;
    namespace?: string;
    isIdentity?: boolean; // TD_ID shim
}

export interface RenameMap {
    oldToNew: pxt.Map<string>;
    takenNames: pxt.Map<boolean>;
    oldToNewFunctions: pxt.Map<string>;
}

export interface PlaceholderLikeBlock extends Blockly.Block {
    p?: Point;
}

export interface BlockCompilationResult {
    source: string;
    sourceMap: pxt.blocks.BlockSourceInterval[];
    stats: pxt.Map<number>;
    diagnostics: BlockDiagnostic[];
}

export interface BlockCompileOptions {
    emitTilemapLiterals?: boolean;
}


export class Point {
    constructor(
        public link: Point,
        public type: string,
        public parentType?: Point,
        public childType?: Point,
        public isArrayType?: boolean
    ) { }
}

export interface Scope {
    parent?: Scope;
    firstStatement: Blockly.Block;
    declaredVars: pxt.Map<VarInfo>;
    referencedVars: number[];
    assignedVars: number[];
    children: Scope[];
}

export enum BlockDeclarationType {
    None = 0,
    Argument,
    Assigned,
    Implicit
}

export interface BlockDiagnostic {
    blockId: string;
    message: string;
}

export interface VarInfo {
    name: string;
    id: number;

    escapedName?: string;
    type?: Point;
    alreadyDeclared?: BlockDeclarationType;
    firstReference?: Blockly.Block;
    isAssigned?: boolean;
    isFunctionParameter?: boolean;
}

export interface GrayBlock extends Blockly.BlockSvg {
    setPythonEnabled(enabled: boolean): void;
}

export interface GrayBlockStatement extends GrayBlock {
    domToMutation(xmlElement: Element): void;
    mutationToDom(): Element;

    getLines: () => string[];
    declaredVariables: string;
}

export function emptyEnv(w: Blockly.Workspace, options: BlockCompileOptions): Environment {
    return {
        workspace: w,
        options,
        stdCallTable: {},
        userFunctionReturnValues: {},
        diagnostics: [],
        errors: [],
        renames: {
            oldToNew: {},
            takenNames: {},
            oldToNewFunctions: {}
        },
        stats: {},
        enums: [],
        kinds: [],
        idToScope: {},
        blockDeclarations: {},
        allVariables: [],
        blocksInfo: null,
        placeholders: {}
    }
}

// This function creates an empty environment where type inference has NOT yet
// been performed.
// - All variables have been assigned an initial [Point] in the union-find.
// - Variables have been marked to indicate if they are compatible with the
//   TouchDevelop for-loop model.
export function mkEnv(w: Blockly.Workspace, blockInfo?: pxtc.BlocksInfo, options: BlockCompileOptions = {}): Environment {
    // The to-be-returned environment.
    let e = emptyEnv(w, options);
    e.blocksInfo = blockInfo;

    // append functions in stdcalltable
    if (blockInfo) {
        // Enums, tagged templates, and namespaces are not enclosed in namespaces,
        // so add them to the taken names to avoid collision
        Object.keys(blockInfo.apis.byQName).forEach(name => {
            const info = blockInfo.apis.byQName[name];
            // Note: the check for info.pkg filters out functions defined in the user's project.
            // Otherwise, after the first compile the function will be renamed because it conflicts
            // with itself. You can still get collisions if you attempt to define a function with
            // the same name as a function defined in another file in the user's project (e.g. custom.ts)
            if (info.pkg && (info.kind === pxtc.SymbolKind.Enum || info.kind === pxtc.SymbolKind.Function || info.kind === pxtc.SymbolKind.Module || info.kind === pxtc.SymbolKind.Variable)) {
                e.renames.takenNames[info.qName] = true;
            }
        });

        if (blockInfo.enumsByName) {
            Object.keys(blockInfo.enumsByName).forEach(k => e.enums.push(blockInfo.enumsByName[k]));
        }

        if (blockInfo.kindsByName) {
            Object.keys(blockInfo.kindsByName).forEach(k => e.kinds.push(blockInfo.kindsByName[k]));
        }

        blockInfo.blocks
            .forEach(fn => {
                if (e.stdCallTable[fn.attributes.blockId]) {
                    pxt.reportError("blocks", "function already defined", {
                        "details": fn.attributes.blockId,
                        "qualifiedName": fn.qName,
                        "packageName": fn.pkg,
                    });
                    return;
                }
                e.renames.takenNames[fn.namespace] = true;
                const comp = pxt.blocks.compileInfo(fn);
                const instance = !!comp.thisParameter;

                e.stdCallTable[fn.attributes.blockId] = {
                    namespace: fn.namespace,
                    f: fn.name,
                    comp,
                    attrs: fn.attributes,
                    isExtensionMethod: instance,
                    isExpression: fn.retType && fn.retType !== "void",
                    imageLiteral: fn.attributes.imageLiteral || fn.attributes.gridLiteral,
                    imageLiteralColumns: fn.attributes.imageLiteralColumns,
                    imageLiteralRows: fn.attributes.imageLiteralRows,
                    hasHandler: pxt.blocks.hasHandler(fn),
                    property: !fn.parameters,
                    isIdentity: fn.attributes.shim == "TD_ID"
                }
            });

        w.getTopBlocks(false).filter(isFunctionDefinition).forEach(b => {
            // Add functions to the rename map to prevent name collisions with variables
            const name = b.type === "procedures_defnoreturn" ? b.getFieldValue("NAME") : b.getField("function_name").getText();
            escapeVarName(name, e, true);
        });
    }

    return e;
}