namespace pxtblockly {
    export class FieldUserEnum extends Blockly.FieldDropdown {
        constructor(private opts: pxtc.EnumInfo) {
            super(createMenuGenerator(opts));
        }

        init() {
            super.init();
            this.initVariables();
        }

        onItemSelected(menu: goog.ui.Menu, menuItem: goog.ui.MenuItem) {
            const value = menuItem.getValue();
            if (value === "CREATE") {
                promptAndCreateEnum(this.sourceBlock_.workspace, this.opts, lf("New {0}:", this.opts.memberName),
                    newName => newName && this.setValue(newName));
            }
            else {
                super.onItemSelected(menu, menuItem);
            }
        }


        private initVariables() {
            if (this.sourceBlock_ && this.sourceBlock_.workspace) {
                if (this.sourceBlock_.isInFlyout) {
                    // Can't create variables from within the flyout, so we just have to fake it
                    // by setting the text instead of the value
                    this.setText(this.opts.initialMembers[0]);
                }
                else {
                    const ws = this.sourceBlock_.workspace;
                    const existing = getMembersForEnum(ws, this.opts.name);
                    this.opts.initialMembers.forEach(memberName => {
                        if (!existing.some(([name, value]) => name === memberName)) {
                            createNewEnumMember(ws, this.opts, memberName);
                        }
                    });

                    if (this.getValue() === "CREATE") {
                        const newValue = getVariableNameForMember(ws, this.opts.name, this.opts.initialMembers[0])
                        if (newValue) {
                            this.setValue(newValue);
                        }
                    }
                }
            }
        }
    }

    function createMenuGenerator(opts: pxtc.EnumInfo): () => string[][] {
        return function () {
            const res: string[][] = [];

            const that = this as FieldUserEnum;
            if (that.sourceBlock_ && that.sourceBlock_.workspace) {
                const options = that.sourceBlock_.workspace.getVariablesOfType(opts.name);
                options.forEach(model => {
                    // The format of the name is 10mem where "10" is the value and "mem" is the enum member
                    const withoutValue = model.name.replace(/^\d+/, "")
                    res.push([withoutValue, model.name]);
                });
            }


            res.push([lf("Add a new {0}...", opts.memberName), "CREATE"]);

            return res;
        }
    }

    function promptAndCreateEnum(ws: Blockly.Workspace, opts: pxtc.EnumInfo, message: string, cb: (newValue: string) => void) {
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
                        () => promptAndCreateEnum(ws, opts, message, cb));
                    return;
                }

                const existing = getMembersForEnum(ws, opts.name);
                for (let i = 0; i < existing.length; i++) {
                    const [name, value] = existing[i];
                    if (name === response) {
                        Blockly.alert(lf("A {0} named '{1}' already exists.", opts.memberName, response),
                            () => promptAndCreateEnum(ws, opts, message, cb));
                        return;
                    }
                }

                cb(createNewEnumMember(ws, opts, response));
            }
        });
    }

    function parseName(model: Blockly.VariableModel): [string, number] {
        const match = /^(\d+)([^0-9].*)$/.exec(model.name);

        if (match) {
            return [match[2], parseInt(match[1])];
        }
        return [model.name, -1];
    }

    function getMembersForEnum(ws: Blockly.Workspace, enumName: string): [string, number][] {
        const existing = ws.getVariablesOfType(enumName);
        if (existing && existing.length) {
            return existing.map(parseName);
        }
        else {
            return [];
        }
    }

    export function getNextValue(members: [string, number][], opts: pxtc.EnumInfo) {
        const existing = members.map(([name, value]) => value);

        if (opts.isBitMask) {
            for (let i = 0; i < existing.length; i++) {
                let current = 1 << i;

                if (existing.indexOf(current) < 0) {
                    return current;
                }
            }
            return 1 << existing.length;
        } else if (opts.isHash) {
            return 0; // overriden when compiled
        }
        else {
            const start = opts.firstValue || 0;
            for (let i = 0; i < existing.length; i++) {
                if (existing.indexOf(start + i) < 0) {
                    return start + i;
                }
            }
            return start + existing.length;
        }
    }

    function createNewEnumMember(ws: Blockly.Workspace, opts: pxtc.EnumInfo, newName: string): string {
        const ex = getMembersForEnum(ws, opts.name);
        const val = getNextValue(ex, opts);
        const variableName = val + newName;
        (Blockly as any).Variables.getOrCreateVariablePackage(ws, null, variableName, opts.name);
        return variableName;
    }

    function getVariableNameForMember(ws: Blockly.Workspace, enumName: string, memberName: string): string {
        const existing = ws.getVariablesOfType(enumName);
        if (existing && existing.length) {
            for (let i = 0; i < existing.length; i++) {
                const [name,] = parseName(existing[i]);
                if (name === memberName) {
                    return existing[i].name;
                }
            }
        }
        return undefined;
    }
}