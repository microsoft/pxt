/* tslint:disable:forin cli only run in node */

const MaxColumns = 100;
const argRegex = /^(-+)?(.+)$/;

export type FlagType = "boolean" | "string" | "number";

export interface CommandFlag {
    description: string;

    argument?: string;
    type?: FlagType;
    aliases?: string[];
    possibleValues?: string[];
    deprecated?: boolean;

}

export interface Command {
    name: string;
    help: string;
    onlineHelp?: boolean;

    priority?: number;
    advanced?: boolean;
    argString?: string;
    flags?: { [index: string]: CommandFlag };
    aliases?: string[];
    numArgs?: number;
    anyArgs?: boolean; // pass all arguments as is

    /* @internal */
    _aliasMap?: { [index: string]: string };
    /* @internal */
    _callback?: (c?: ParsedCommand) => Promise<void>;
}

export interface ParsedCommand {
    name: string;
    args: string[];
    flags: { [index: string]: boolean | string | number };
}

export class CommandParser {
    private commands: Command[] = [];

    public defineCommand(c: Command, callback: (c?: ParsedCommand) => Promise<void>) {
        const aliasMap: { [index: string]: string } = {};

        for (const flag in c.flags) {
            const def = c.flags[flag];

            recordAlias(flag, flag);
            const aliases = c.flags[flag].aliases;
            if (aliases) {
                aliases.forEach(alias => {
                    recordAlias(flag, alias);
                });
            }
        }

        c._aliasMap = aliasMap;
        c._callback = callback;
        this.commands.push(c);

        function recordAlias(flag: string, alias: string) {
            if (aliasMap[alias]) {
                throw new Error(`Alias ${alias} for flag ${flag} duplicates the alias for flag ${aliasMap[alias]}`);
            }
            aliasMap[alias] = flag;
        }
    }

    public parseCommand(args: string[]): Promise<void> {
        if (!args[0])
            args = ["help"];
        const name = args[0];
        const parsedArgs: string[] = [];
        const flags: { [index: string]: string | boolean | number } = {};

        const filtered = this.commands.filter(c => c.name === name || c.aliases && c.aliases.indexOf(name) !== -1);
        if (!filtered.length)
            pxt.U.userError(`Command '${name}' not found, use "pxt help all" to see available commands.`);

        const command = filtered[0];

        if (command.anyArgs)
            return command._callback({
                name: command.name,
                args: args.slice(1),
                flags
            });

        let currentFlag: string;
        let currentFlagDef: CommandFlag;

        for (let i = 1; i < args.length; i++) {
            const match = argRegex.exec(args[i]);
            if (!match) {
                continue;
            }

            if (match[1]) {
                if (currentFlag)
                    pxt.U.userError(`Expected value to follow flag '${currentFlag}'`);

                const flagName = command._aliasMap[match[2]];
                const debugFlag = flagName || match[2];
                if (debugFlag == "debug" || debugFlag == "d" || debugFlag == "dbg") {
                    pxt.options.debug = true;
                    pxt.debug = console.log;
                    pxt.log(`debug mode`);
                    if (!flagName)
                        continue;
                }
                if (!flagName)
                    pxt.U.userError(`Unrecognized flag '${match[2]}' for command '${command.name}'`)

                const flagDefinition = command.flags[flagName];

                if (flagDefinition.argument) {
                    currentFlag = flagName;
                    currentFlagDef = flagDefinition;
                }
                else {
                    flags[flagName] = true;
                }
            }
            else if (currentFlag) {
                if (currentFlagDef.possibleValues && currentFlagDef.possibleValues.length && currentFlagDef.possibleValues.indexOf(match[2]) === -1) {
                    pxt.U.userError(`Unknown value for flag '${currentFlag}', '${match[2]}'`);
                }

                if (!currentFlagDef.type || currentFlagDef.type === "string") {
                    flags[currentFlag] = match[2];
                }
                else if (currentFlagDef.type === "boolean") {
                    flags[currentFlag] = match[2].toLowerCase() === "true";
                }
                else {
                    try {
                        flags[currentFlag] = parseFloat(match[2])
                    }
                    catch (e) {
                        throw new Error(`Flag '${currentFlag}' expected an argument of type number but received '${match[2]}'`)
                    }
                }

                currentFlag = undefined;
                currentFlagDef = undefined;
            }
            else {
                parsedArgs.push(match[2]);
            }
        }

        if (currentFlag) {
            pxt.U.userError(`Expected value to follow flag '${currentFlag}'`)
        }
        else if (!command.argString && parsedArgs.length) {
            pxt.U.userError(`Command '${command.name}' expected exactly 0 argument(s) but received ${parsedArgs.length}`);
        }
        else if (command.numArgs && parsedArgs.length !== command.numArgs) {
            pxt.U.userError(`Command '${command.name}' expected exactly ${command.numArgs} argument(s) but received ${parsedArgs.length}`);
        }

        return command._callback({
            name: command.name,
            args: parsedArgs,
            flags
        });
    }

    public printHelp(args: string[], print: (s: string) => void) {
        if (args && args.length === 1) {
            const name = args[0];
            if (name === "all") {
                this.printTopLevelHelp(true, print);
            }
            else {
                const filtered = this.commands.filter(c => c.name === name || c.aliases && c.aliases.indexOf(name) !== -1);
                if (filtered) {
                    this.printCommandHelp(filtered[0], print);
                }
            }
        }
        else {
            this.printTopLevelHelp(false, print);
        }
    }

    private printCommandHelp(c: Command, print: (s: string) => void) {
        let usage = `    pxt ${c.name}`
        if (c.argString) {
            usage += " " + c.argString;
        }
        if (c.flags) {
            for (const flag in c.flags) {
                const def = c.flags[flag];
                if (def.possibleValues && def.possibleValues.length) {
                    usage += ` [${dash(flag)} ${def.possibleValues.join("|")}]`
                }
                else if (def.argument) {
                    usage += ` [${dash(flag)} ${def.argument}]`
                }
                else {
                    usage += ` [${dash(flag)}]`;
                }
            }
        }

        print("");
        print("Usage:")
        print(usage);
        print("")
        print(c.help);

        if (c.aliases && c.aliases.length) {
            print("");
            print("Aliases:")
            c.aliases.forEach(a => print("    " + a));
        }

        const flagNames: string[] = [];
        const flagDescriptions: string[] = [];

        let maxWidth = 0;
        for (const flag in c.flags) {
            const def = c.flags[flag];
            if (def.deprecated) continue;
            let usage = dash(flag);
            if (def.aliases && def.aliases.length) {
                usage += " " + def.aliases.map(dash).join(" ");
            }

            if (def.argument) {
                if (def.possibleValues && def.possibleValues.length) {
                    usage += ` <${def.possibleValues.join("|")}>`;
                }
                else {
                    usage += def.type && def.type === "number" ? " <number>" : " <value>"
                }
            }

            maxWidth = Math.max(maxWidth, usage.length);
            flagNames.push(usage);
            flagDescriptions.push(def.description);
        }

        if (flagNames.length) {
            print("");
            print("Flags:")
            for (let i = 0; i < flagNames.length; i++) {
                printLine(flagNames[i], maxWidth, flagDescriptions[i], print);
            }
        }

        if (c.onlineHelp)
            print(`More information at ${"https://makecode.com/cli/" + c.name} .`);
    }

    private printTopLevelHelp(advanced: boolean, print: (s: string) => void) {
        print("");
        print("Usage: pxt <command>");
        print("");
        print("Commands:")

        this.commands.sort((a, b) => a.priority - b.priority);

        const toPrint = advanced ? this.commands : this.commands.filter(c => !c.advanced);

        const cmdDescriptions: string[] = [];

        let maxNameWidth = 0;
        const names: string[] = toPrint.map(command => {
            maxNameWidth = Math.max(maxNameWidth, command.name.length);
            cmdDescriptions.push(command.help);
            return command.name;
        });

        for (let i = 0; i < names.length; i++) {
            printLine(names[i], maxNameWidth, cmdDescriptions[i], print);
        }

        print("");
        print("For more information on a command, try 'pxt help <command>'")
    }
}

function printLine(name: string, maxNameWidth: number, description: string, print: (s: string) => void) {
    // Lines are of the format: name ...... description
    let line = pad(`    ${name} `, maxNameWidth - name.length + 3, false, ".");
    const prefixLength = line.length;

    // Split the description into words so that we can try and do some naive wrapping
    const dWords = description.split(" ");
    dWords.forEach(w => {
        if (line.length + w.length < MaxColumns) {
            line += " " + w
        }
        else {
            print(line);
            line = pad(w, prefixLength + 1, true);
        }
    });
    print(line);
}

function pad(str: string, len: number, left: boolean, char = " ") {
    for (let i = 0; i < len; i++) {
        if (left) {
            str = char + str;
        }
        else {
            str += char;
        }
    }
    return str;
}

function dash(flag: string) {
    if (flag.length === 1) {
        return "-" + flag;
    }
    return "--" + flag;
}