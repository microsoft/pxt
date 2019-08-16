namespace pxt.py {
    import B = pxt.blocks;

    export interface OverrideTextPart {
        kind: "text";
        text: string;
    }

    export interface OverrideArgPart {
        kind: "arg";
        index: number;
        isOptional: boolean;
        prefix?: string;
        default?: string;
    }

    export type OverridePart = OverrideArgPart | OverrideTextPart;

    export interface OverrideMap {
        parts: OverridePart[];
        isProperty: boolean;
    }

    /**
     * Override example syntax:
     *      indexOf()       (no arguments)
     *      indexOf($1, $0) (arguments in different order)
     *      indexOf($0?)    (optional argument)
     *      indexOf($0=0)   (default value; can be numbers, single quoted strings, false, true, null, undefined)
     */
    export function parseTypeScriptOverride(src: string): OverrideMap {
        const regex = /([^\$]*\()?([^\$\(]*)\$(\d)(?:(?:(?:=(\d+|'[a-zA-Z0-9_]*'|false|true|null|undefined))|(\?)|))/y;
        const parts: OverridePart[] = [];

        let match;
        let lastIndex = 0;

        do {
            lastIndex = regex.lastIndex;

            match = regex.exec(src);

            if (match) {
                if (match[1]) {
                    parts.push({
                        kind: "text",
                        text: match[1]
                    });
                }

                parts.push({
                    kind: "arg",
                    prefix: match[2],
                    index: parseInt(match[3]),
                    default: match[4],
                    isOptional: !!match[5]
                })
            }
        } while (match)

        if (lastIndex != undefined) {
            parts.push({
                kind: "text",
                text: src.substr(lastIndex)
            });
        }
        else {
            parts.push({
                kind: "text",
                text: src
            });
        }

        return {
            parts,
            isProperty: ts.isIdentifierStart(src.charCodeAt(0), ts.ScriptTarget.ES5)
        };
    }

    export function buildOverride(override: OverrideMap, args: B.JsNode[], recv?: B.JsNode) {
        const result: B.JsNode[] = [];

        for (const part of override.parts) {
            if (part.kind === "text") {
                result.push(B.mkText(part.text));
            }
            else if (args[part.index] || part.default) {
                if (part.prefix) result.push(B.mkText(part.prefix))

                if (args[part.index]) {
                    result.push(args[part.index]);
                }
                else {
                    result.push(B.mkText(part.default))
                }
            }
            else if (part.isOptional) {
                // do nothing
            }
            else {
                return undefined;
            }
        }

        if (recv) {
            if (override.isProperty) {
                return B.mkInfix(recv, ".", B.mkGroup(result));
            }
            else {
                return B.mkGroup([recv].concat(result));
            }
        }

        return B.mkGroup(result);
    }

    export function buildOverrideString(override: OverrideMap, args: string[], recv?: string) {
        let res = "";
        for (const part of override.parts) {
            if (part.kind === "text") {
                res += part.text
            }
            else if (args[part.index] || part.default) {
                if (part.prefix) res += part.prefix

                if (args[part.index]) {
                    res += args[part.index]
                }
                else {
                    res += part.default;
                }
            }
            else if (part.isOptional) {
                // do nothing
            }
            else {
                return undefined;
            }
        }

        if (recv) {
            return `${recv}${override.isProperty ? "." : ""}${res}`;
        }

        return res;
    }
}