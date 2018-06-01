namespace pxtblockly {
    export interface FieldUserEnumStrings {
        // The name of the enum as it should appear in the code
        enumName: string;

        // The word(s) used to describe a member of the enum. For example, if the enum
        // was called "Colors" then this value would be "color"
        memberName: string;
    }

    export class FieldUserEnum extends Blockly.FieldDropdown {
        constructor(private opts: FieldUserEnumStrings) {
            super(createMenuGenerator(opts));
        }

        onItemSelected(menu: goog.ui.Menu, menuItem: goog.ui.MenuItem) {
            const value = menuItem.getValue();
            if (value === "CREATE") {
                promptAndCreateEnum(this.sourceBlock_.workspace, this.opts, lf("New {0}:", this.opts.memberName));
            }
            else {
                super.onItemSelected(menu, menuItem);
            }
        }
    }

    function createMenuGenerator(opts: FieldUserEnumStrings): () => string[][] {
        return function () {
            const res: string[][] = [];

            const that = this as FieldUserEnum;
            if (that.sourceBlock_ && that.sourceBlock_.workspace) {
                const options = that.sourceBlock_.workspace.getVariablesOfType(opts.enumName);
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

    function promptAndCreateEnum(ws: Blockly.Workspace, opts: FieldUserEnumStrings, message: string) {
        Blockly.prompt(message, "player", response => {
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
                    promptAndCreateEnum(ws, opts, lf("Names must be valid JavaScript identifiers"));
                    return;
                }

                const existing = ws.getVariablesOfType(opts.enumName);
                let highestValue = -1;
                for (let i = 0; i < existing.length; i++) {
                    const [name, value] = parseName(existing[i]);
                    if (name === response) {
                        promptAndCreateEnum(ws, opts, lf("The name '{0}' is already taken", response));
                        return;
                    }
                    highestValue = Math.max(highestValue, value);
                }

                const varName = (highestValue + 1) + response;

                (Blockly as any).Variables.getOrCreateVariablePackage(ws, null, varName, opts.enumName);
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
}