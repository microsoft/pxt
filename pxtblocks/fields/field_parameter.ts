/// <reference path="../../localtypings/pxtblockly.d.ts" />

declare namespace Blockly {
    interface Workspace {
        createVariable(name: string): VariableModel;
        getVariable(name: string): VariableModel;
        renameVariable(oldName: string, newName: string): void;
    }
}

declare namespace Blockly.Msg {
    const RENAME_VARIABLE_TITLE: string;
    const VARIABLE_ALREADY_EXISTS_FOR_ANOTHER_TYPE: string;
}

declare namespace Blockly.Events {
    const VAR_DELETE: string;
    const VAR_RENAME: string;

    interface VarDelete extends Blockly.BlocklyEvent {
        varName: string;
        varType: string;
    }

    interface VarRename extends Blockly.BlocklyEvent {
        oldName: string;
        newName: string;
    }
}

declare namespace Blockly.Variables {
    function renameVariable(workspace: Workspace, variable: VariableModel, cb?: (newValue: string) => void): void;
    function promptName(promptText: string, defaultText: string, callback: (newVar: string) => void): void;
}

namespace pxtblockly {
    export class FieldParameter extends Blockly.FieldTextInput {
        currentName: string;
        defaultName: string;
        restrictedNames: string[];

        constructor(initialName: string, defaultName: string, restrictedNames: string[]) {
            super(initialName, null);
            this.currentName = initialName;
            this.defaultName = defaultName;
            this.restrictedNames = [];
            restrictedNames.forEach(name => {
                if (name === this.defaultName) return;
                this.restrictedNames.push(name.toLowerCase());
            });
        }

        init(b?: Blockly.Block) {
            if (this.fieldGroup_) {
                return;
            }
            super.init(b);
            this.getOrCreateVariable();

            this.sourceBlock_.workspace.addChangeListener(e => {
                if (!e) return;
                if (e.type === Blockly.Events.VAR_DELETE) {
                    const deleteEvent = e as Blockly.Events.VarDelete;
                    if (deleteEvent.varName === this.currentName) {
                        this.currentName = this.defaultName;
                        this.setValue(this.defaultName);
                        this.getOrCreateVariable();
                    }
                }
                else if (e.type === Blockly.Events.VAR_RENAME) {
                    const renameEvent = e as Blockly.Events.VarRename;
                    if (renameEvent.oldName === this.currentName && renameEvent.newName !== this.currentName) {
                        this.setValue(renameEvent.newName);
                        this.currentName = renameEvent.newName;
                    }
                }
            });
        }

        showEditor_() {
            (this as any).workspace_ = this.sourceBlock_.workspace;
            this.renameDialog(this.getOrCreateVariable());
        }

        renameDialog(variable: Blockly.VariableModel) {
            const workspace = this.sourceBlock_.workspace;

            let openRenameDialog = (inputValue: string) => {
                Blockly.Variables.promptName(
                    Blockly.Msg.RENAME_VARIABLE_TITLE.replace('%1', variable.name), inputValue,
                    newName => {
                        if (newName) {
                            var newVariable = workspace.getVariable(newName);
                            if (this.isRestrictedName(newName)) {
                                Blockly.alert(lf("The name '{0}' is reserved. To select that parameter use the gear wheel on the block or enter a different name", newName), () => {
                                    openRenameDialog(newName);
                                });
                            }
                            else if (newVariable) {
                                Blockly.alert(lf("A variable with the name '{0}' already exists", newName), () => {
                                    openRenameDialog(newName);
                                });
                            }
                            else {
                                workspace.renameVariable(variable.name, newName);
                            }
                        }
                    });
            };
            openRenameDialog('');
        }

        private getOrCreateVariable() {
            if (!this.sourceBlock_) {
                return undefined;
            }
            const ws = this.sourceBlock_.workspace;
            const v = ws.getVariable(this.currentName);
            if (v) {
                return v;
            }
            else {
                return ws.createVariable(this.currentName);
            }
        }

        private isRestrictedName(name: string) {
            name = name.toLowerCase().replace(/\s/g, '');
            return this.restrictedNames.indexOf(name) != -1;
        }
    }
}