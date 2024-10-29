import * as Blockly from "blockly";
import { MsgKey } from "./msg";
import { StringMap } from "./utils";

export type ConfirmEditCallback = (mutation: Element) => void;

export class FunctionManager {
    private static instance: FunctionManager = new FunctionManager();


    static getInstance() {
        return FunctionManager.instance
    }

    protected _editFunctionExternal: (mutation: Element, cb: ConfirmEditCallback) => void;
    protected typeIcons: StringMap<string> = {};
    protected typeArgumentNames: StringMap<string> = {};

    protected constructor() {}

    getIconForType(typeName: string) {
        return this.typeIcons[typeName];
    }

    setIconForType(typeName: string, icon: string) {
        this.typeIcons[icon] = typeName;
    }

    setArgumentNameForType(typeName: string, name: string) {
        this.typeArgumentNames[typeName] = name;
    }

    getArgumentNameForType(typeName: string) {
        if (this.typeArgumentNames[typeName]) {
            return this.typeArgumentNames[typeName];
        }
        return Blockly.Msg[MsgKey.FUNCTIONS_DEFAULT_CUSTOM_ARG_NAME];
    }

    setEditFunctionExternal(impl: (mutation: Element, cb: ConfirmEditCallback) => void)  {
        this._editFunctionExternal = impl;
    }

    editFunctionExternal(mutation: Element, cb: ConfirmEditCallback): void {
        if (this._editFunctionExternal) {
            this._editFunctionExternal(mutation, cb);
        }
        else {
            pxt.warn('External function editor must be overriden: Blockly.Functions.editFunctionExternalHandler', mutation, cb);
        }
    }
}
