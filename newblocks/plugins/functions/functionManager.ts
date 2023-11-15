import * as Blockly from "blockly/core";
import { MsgKey } from "./msg";
import { StringMap } from "./utils";

export class FunctionManager {
    private static instance: FunctionManager = new FunctionManager();

    static getInstance() {
        return FunctionManager.instance
    }

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
}
