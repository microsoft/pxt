namespace pxt {
    export interface MarkdownSection {
        headerKind: "single" | "double" | "triple";
        header: string;
        attributes: pxt.Map<string>;
        listAttributes?: pxt.Map<MarkdownList>;
    }

    export interface MarkdownList {
        key: string;
        items: (string | MarkdownList)[];
    }

    export function getSectionsFromMarkdownMetadata(text: string): MarkdownSection[] {
        const lines = text.split(/\r?\n/);

        let sections: MarkdownSection[] = [];
        let currentSection: MarkdownSection | null = null;

        let currentKey: string | null = null;
        let currentValue: string | null = null;
        let listStack: MarkdownList[] = [];

        let currentIndent = 0;

        for (const line of lines) {
            if (!line.trim()) {
                if (currentValue) {
                    currentValue += "\n";
                }
                continue;
            }

            if (line.startsWith("#")) {
                const headerMatch = /^(#+)\s*(.+)$/.exec(line);

                if (headerMatch) {
                    pushSection();

                    currentSection = {
                        headerKind: headerMatch[1].length === 1 ? "single" :
                            (headerMatch[1].length === 2 ? "double" : "triple"),
                        header: headerMatch[2],
                        attributes: {}
                    }
                    currentKey = null;
                    currentValue = null;
                    currentIndent = 0;
                    continue;
                }
            }

            if (currentSection) {
                const indent = countIndent(line);
                const trimmedLine = line.trim();

                const keyMatch = /^[*-]\s+(?:([^:]+):)?(.*)$/.exec(trimmedLine);
                if (!keyMatch) continue;

                // We ignore indent changes of 1 space to make the list authoring a little
                // bit friendlier. Likewise, indents can be any length greater than 1 space
                if (Math.abs(indent - currentIndent) > 1 && currentKey) {
                    if (indent > currentIndent) {
                        const newList = {
                            key: currentKey,
                            items: [] as string[]
                        };

                        if (listStack.length) {
                            listStack[listStack.length - 1].items.push(newList);
                        }
                        else {
                            if (!currentSection.listAttributes) currentSection.listAttributes = {};
                            currentSection.listAttributes[currentKey] = newList;
                        }
                        currentKey = null;
                        listStack.push(newList);
                    }
                    else {
                        const prev = listStack.pop();

                        if (currentKey && currentValue) {
                            prev?.items.push((currentKey + ":" + currentValue).trim())
                            currentValue = null;
                        }
                    }

                    currentIndent = indent;
                }

                if (keyMatch) {
                    if (keyMatch[1]) {
                        if (currentKey && currentValue) {
                            if (listStack.length) {
                                listStack[listStack.length - 1].items.push((currentKey + ":" + currentValue).trim());
                            }
                            else {
                                currentSection.attributes[currentKey] = currentValue.trim();
                            }
                        }

                        currentKey = keyMatch[1].trim().toLowerCase();
                        currentValue = keyMatch[2];
                    }
                    else if (currentKey) {
                        currentValue += keyMatch[2];
                    }
                }
            }
        }

        pushSection();

        return sections;

        function pushSection() {
            if (currentSection) {
                if (currentKey && currentValue) {
                    if (listStack.length) {
                        listStack[listStack.length - 1].items.push((currentKey + ":" + currentValue).trim());
                    }
                    else {
                        currentSection.attributes[currentKey] = currentValue.trim();
                    }
                }
                sections.push(currentSection);
            }

            listStack = [];
        }
    }

    // Handles tabs and spaces, but a mix of them might end up with strange results. Not much
    // we can do about that so just treat 1 tab as 4 spaces
    function countIndent(line: string) {
        let indent = 0;
        for (let i = 0; i < line.length; i++) {
            if (line.charAt(i) === " ") indent++;
            else if (line.charAt(i) === "\t") indent += 4;
            else return indent;
        }
        return 0;
    }
}
