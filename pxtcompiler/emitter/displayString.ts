namespace ts.pxtc.service {
    /**
     * Produces a markdown string for the symbol that is suitable for display in Monaco
     */
    export function displayStringForSymbol(sym: SymbolInfo, python: boolean, apiInfo: ApisInfo) {
        if (!sym) return undefined;

        switch (sym.kind) {
            case SymbolKind.Function:
            case SymbolKind.Method:
                return displayStringForFunction(sym, python, apiInfo);
            case SymbolKind.Enum:
            case SymbolKind.EnumMember:
                return displayStringForEnum(sym, python);
            case SymbolKind.Module:
                return displayStringForNamepsace(sym, python);
            case SymbolKind.Interface:
                return displayStringForInterface(sym, python);
            case SymbolKind.Class:
                return displayStringForClass(sym, python);
            case SymbolKind.Variable:
                return displayStringForVariable(sym, python, apiInfo);
            case SymbolKind.Property:
                return displayStringForProperty(sym, python, apiInfo);
        }

        return `**${sym.qName}**`
    }

    function displayStringForFunction(sym: SymbolInfo, python: boolean, apiInfo: ApisInfo) {
        let prefix = "";
        if (sym.kind === SymbolKind.Function) {
            prefix += python ? "def " : "function ";
        }
        else {
            prefix += "(method) "
        }

        prefix += python ? sym.pyQName : sym.qName;
        let argString = "";

        if (sym.parameters && sym.parameters.length) {
            argString = sym.parameters.map(param =>
                `${param.name}: ${python ? param.pyTypeString : param.type}`
            ).join(", ");
        }

        let retType = sym.retType || "void";

        if (python) {
            retType = getPythonReturnType(retType, apiInfo);
        }

        return codeBlock(`${prefix}(${argString}): ${retType}`, python);
    }

    function displayStringForEnum(sym: SymbolInfo, python: boolean) {
        const qName = python ? sym.pyQName : sym.qName
        if (sym.kind === SymbolKind.Enum) {
            return codeBlock(`enum ${qName}`, python);
        }

        let memberString = `(enum member) ${qName}`;
        if (sym.attributes.enumval) {
            memberString += ` = ${sym.attributes.enumval}`;
        }

        return codeBlock(memberString, false)
    }

    function displayStringForNamepsace(sym: SymbolInfo, python: boolean) {
        return codeBlock(`namespace ${python ? sym.pyQName : sym.qName}`, false);
    }

    function displayStringForInterface(sym: SymbolInfo, python: boolean) {
        return codeBlock(`interface ${python ? sym.pyQName : sym.qName}`, false);
    }

    function displayStringForClass(sym: SymbolInfo, python: boolean) {
        return codeBlock(`class ${python ? sym.pyQName : sym.qName}`, python);
    }

    function displayStringForVariable(sym: SymbolInfo, python: boolean, apiInfo: ApisInfo) {
        let varString = python ? sym.pyQName : `let ${sym.qName}`;

        if (sym.retType) {
            let retType = sym.retType;

            if (python) {
                retType = getPythonReturnType(retType, apiInfo);
            }
            return codeBlock(`${varString}: ${retType}`, python);
        }

        return codeBlock(varString, python);
    }

    function displayStringForProperty(sym: SymbolInfo, python: boolean, apiInfo: ApisInfo) {
        const propString = `(property) ${python ? sym.pyQName : sym.qName}`;

        if (sym.retType) {
            let retType = sym.retType;

            if (python) {
                retType = getPythonReturnType(retType, apiInfo);
            }
            return codeBlock(`${propString}: ${retType}`, false);
        }
        return codeBlock(propString, false);
    }

    function getPythonReturnType(type: string, apiInfo: ApisInfo): string {
        switch (type) {
            case "void": return "None";
            case "boolean": return "bool";
            case "string": return "str";
        }

        if (apiInfo.byQName[type]?.pyQName) {
            return apiInfo.byQName[type].pyQName;
        }

        const arrayMatch = /^(?:Array<(.+)>)|(?:(.+)\[\])|(?:\[.+\])$/.exec(type);

        if (arrayMatch) {
            return `List[${getPythonReturnType(arrayMatch[1] || arrayMatch[2], apiInfo)}]`;
        }

        return type;
    }

    function codeBlock(content: string, python: boolean) {
        // The stock TypeScript language service always uses js tags instead of ts. We
        // don't include the js language service in monaco, so use ts instead. It produces
        // slightly different syntax highlighting
        return `\`\`\`${python ? "python" : "ts"}\n${content}\n\`\`\``
    }
}