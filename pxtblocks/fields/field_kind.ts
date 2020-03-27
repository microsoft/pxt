namespace pxtblockly {
    export class FieldKind extends Blockly.FieldDropdown {
        constructor(private opts: pxtc.KindInfo) {
            super(createMenuGenerator(opts));
        }

        initView() {
            super.initView();
            this.initVariables();
        }

        onItemSelected_(menu: Blockly.Menu, menuItem: Blockly.MenuItem) {
            const value = menuItem.getValue();
            if (value === "CREATE") {
                promptAndCreateKind(this.sourceBlock_.workspace, this.opts, lf("New {0}:", this.opts.memberName),
                    newName => newName && this.setValue(newName));
            }
            else {
                super.onItemSelected_(menu, menuItem);
            }
        }

        doClassValidation_(value: any) {
            // update cached option list when adding a new kind
            if (this.opts?.initialMembers && !this.opts.initialMembers.find(el => el == value)) this.getOptions();
            return super.doClassValidation_(value);
        }

        private initVariables() {
            if (this.sourceBlock_ && this.sourceBlock_.workspace) {
                const ws = this.sourceBlock_.workspace;
                const existing = getExistingKindMembers(ws, this.opts.name);
                this.opts.initialMembers.forEach(memberName => {
                    if (existing.indexOf(memberName) === -1) {
                        createVariableForKind(ws, this.opts, memberName);
                    }
                });

                if (this.getValue() === "CREATE") {
                    if (this.opts.initialMembers.length) {
                        this.setValue(this.opts.initialMembers[0]);
                    }
                }
            }
        }
    }

    function createMenuGenerator(opts: pxtc.KindInfo): () => string[][] {
        return function () {
            const res: string[][] = [];

            const that = this as FieldKind;
            if (that.sourceBlock_ && that.sourceBlock_.workspace) {
                const options = that.sourceBlock_.workspace.getVariablesOfType(kindType(opts.name));
                options.forEach(model => {
                    res.push([model.name, model.name]);
                });
            } else {
                // Can't create variables from within the flyout, so we just have to fake it
                opts.initialMembers.forEach((e) => res.push([e, e]) );
            }


            res.push([lf("Add a new {0}...", opts.memberName), "CREATE"]);

            return res;
        }
    }

    function promptAndCreateKind(ws: Blockly.Workspace, opts: pxtc.KindInfo, message: string, cb: (newValue: string) => void) {
        Blockly.prompt(message, opts.promptHint, response => {
            if (response) {
                let nameIsValid = false;
                if (pxtc.isIdentifierStart(response.charCodeAt(0), 2)) {
                    nameIsValid = true;
                    for (let i = 1; i < response.length; i++) {
                        if (!pxtc.isIdentifierPart(response.charCodeAt(i), 2)) {
                            nameIsValid = false;
                        }
                    }
                }

                if (!nameIsValid) {
                    Blockly.alert(lf("Names must start with a letter and can only contain letters, numbers, '$', and '_'."),
                        () => promptAndCreateKind(ws, opts, message, cb));
                    return;
                }

                const existing = getExistingKindMembers(ws, opts.name);
                for (let i = 0; i < existing.length; i++) {
                    const name = existing[i];
                    if (name === response) {
                        Blockly.alert(lf("A {0} named '{1}' already exists.", opts.memberName, response),
                            () => promptAndCreateKind(ws, opts, message, cb));
                        return;
                    }
                }

                if (response === opts.createFunctionName) {
                    Blockly.alert(lf("'{0}' is a reserved name.", opts.createFunctionName),
                        () => promptAndCreateKind(ws, opts, message, cb));
                }

                cb(createVariableForKind(ws, opts, response));
            }
        });
    }


    function getExistingKindMembers(ws: Blockly.Workspace, kindName: string): string[] {
        const existing = ws.getVariablesOfType(kindType(kindName));
        if (existing && existing.length) {
            return existing.map(m => m.name);
        }
        else {
            return [];
        }
    }

    function createVariableForKind(ws: Blockly.Workspace, opts: pxtc.KindInfo, newName: string): string {
        Blockly.Variables.getOrCreateVariablePackage(ws, null, newName, kindType(opts.name));
        return newName;
    }

    function kindType(name: string) {
        return "KIND_" + name;
    }
}