namespace ts.pxtc {
    let reportDiagnostic = reportDiagnosticSimply;

    function reportDiagnostics(diagnostics: ReadonlyArray<Diagnostic>): void {
        for (const diagnostic of diagnostics) {
            reportDiagnostic(diagnostic);
        }
    }

    function reportDiagnosticSimply(diagnostic: Diagnostic): void {
        let output = getDiagnosticString(diagnostic)
        sys.write(output);
    }

    export function getDiagnosticString(diagnostic: KsDiagnostic | Diagnostic): string {
        let ksDiagnostic: KsDiagnostic;
        if (isTsDiagnostic(diagnostic)) {
            // convert ts.Diagnostic to KsDiagnostic
            let tsDiag = diagnostic as ts.Diagnostic
            const { line, character } = getLineAndCharacterOfPosition(tsDiag.file, tsDiag.start);
            const relativeFileName = tsDiag.file.fileName;
            ksDiagnostic = Object.assign({
                fileName: relativeFileName,
                line: line,
                column: character
            }, tsDiag)
        } else {
            ksDiagnostic = Object.assign({
                fileName: undefined,
                line: undefined,
                column: undefined
            }, diagnostic)
        }
        return getDiagnosticStringHelper(ksDiagnostic)
    }
    function getDiagnosticStringHelper(diagnostic: KsDiagnostic): string {
        let output = "";

        if (diagnostic.fileName) {
            output += `${diagnostic.fileName}(${diagnostic.line + 1},${diagnostic.column + 1}): `;
        }

        const category = DiagnosticCategory[diagnostic.category].toLowerCase();
        output += `${category} TS${diagnostic.code}: ${flattenDiagnosticMessageText(diagnostic.messageText, sys.newLine)}${sys.newLine}`;

        return output
    }

    function isTsDiagnostic(a: KsDiagnostic | Diagnostic): a is Diagnostic {
        return (DiagnosticCategory as any).file != undefined;
    }

    export function plainTscCompileDir(dir: string): Program {
        const commandLine = parseCommandLine([]);
        let configFileName = findConfigFile(dir, sys.fileExists);
        const configParseResult = parseConfigFile();
        let program = plainTscCompileFiles(configParseResult.fileNames, configParseResult.options)
        let diagnostics = getProgramDiagnostics(program)
        diagnostics.forEach(reportDiagnostic)
        return program

        function parseConfigFile(): ParsedCommandLine {
            let cachedConfigFileText = sys.readFile(configFileName);

            const result = parseConfigFileTextToJson(configFileName, cachedConfigFileText);
            const configObject = result.config;
            if (!configObject) {
                reportDiagnostics([result.error]);
                sys.exit(ExitStatus.DiagnosticsPresent_OutputsSkipped);
                return undefined;
            }
            const configParseResult = parseJsonConfigFileContent(configObject, sys, dir, commandLine.options, configFileName);
            if (configParseResult.errors.length > 0) {
                reportDiagnostics(configParseResult.errors);
                sys.exit(ExitStatus.DiagnosticsPresent_OutputsSkipped);
                return undefined;
            }

            return configParseResult;
        }
    }

    export function plainTscCompileFiles(fileNames: string[], compilerOpts: ts.CompilerOptions): Program {
        const compilerHost = createCompilerHost(compilerOpts);
        compilerHost.getDefaultLibFileName = () => "node_modules/typescript/lib/lib.d.ts"
        let prog = createProgram(fileNames, compilerOpts, compilerHost);
        return prog

        //const emitOutput = program.emit();
        //diagnostics = diagnostics.concat(emitOutput.diagnostics);
    }

    export function getProgramDiagnostics(program: ts.Program) {
        let diagnostics = program.getSyntacticDiagnostics();
        if (diagnostics.length === 0) {
            diagnostics = program.getOptionsDiagnostics().concat(Util.toArray(program.getGlobalDiagnostics()));
            if (diagnostics.length === 0) {
                diagnostics = program.getSemanticDiagnostics();
            }
        }
        return diagnostics
    }
}