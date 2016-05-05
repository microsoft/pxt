namespace ts.pxt {
    let reportDiagnostic = reportDiagnosticSimply;

    function reportDiagnostics(diagnostics: Diagnostic[], host: CompilerHost): void {
        for (const diagnostic of diagnostics) {
            reportDiagnostic(diagnostic, host);
        }
    }

    function reportDiagnosticSimply(diagnostic: Diagnostic, host: CompilerHost): void {
        let output = "";

        if (diagnostic.file) {
            const { line, character } = getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
            const relativeFileName = diagnostic.file.fileName;
            output += `${relativeFileName}(${line + 1},${character + 1}): `;
        }

        const category = DiagnosticCategory[diagnostic.category].toLowerCase();
        output += `${category} TS${diagnostic.code}: ${flattenDiagnosticMessageText(diagnostic.messageText, sys.newLine)}${sys.newLine}`;

        sys.write(output);
    }

    export function plainTsc(dir: string): Program {
        const commandLine = parseCommandLine([]);
        let configFileName = findConfigFile(dir, sys.fileExists);

        return performCompilation();

        function parseConfigFile(): ParsedCommandLine {
            let cachedConfigFileText = sys.readFile(configFileName);

            const result = parseConfigFileTextToJson(configFileName, cachedConfigFileText);
            const configObject = result.config;
            if (!configObject) {
                reportDiagnostics([result.error], /* compilerHost */ undefined);
                sys.exit(ExitStatus.DiagnosticsPresent_OutputsSkipped);
                return;
            }
            const configParseResult = parseJsonConfigFileContent(configObject, sys, dir, commandLine.options, configFileName);
            if (configParseResult.errors.length > 0) {
                reportDiagnostics(configParseResult.errors, /* compilerHost */ undefined);
                sys.exit(ExitStatus.DiagnosticsPresent_OutputsSkipped);
                return;
            }

            return configParseResult;
        }

        function performCompilation() {
            const configParseResult = parseConfigFile();
            const compilerHost = createCompilerHost(configParseResult.options);
            compilerHost.getDefaultLibFileName = () => "node_modules/typescript/lib/lib.d.ts"
            return compile(configParseResult.fileNames, configParseResult.options, compilerHost);
        }
    }

    function compile(fileNames: string[], compilerOptions: CompilerOptions, compilerHost: CompilerHost) {
        const program = createProgram(fileNames, compilerOptions, compilerHost);
        compileProgram();
        return program;

        function compileProgram() {
            let diagnostics = program.getSyntacticDiagnostics();
            if (diagnostics.length === 0) {
                diagnostics = program.getOptionsDiagnostics().concat(program.getGlobalDiagnostics());
                if (diagnostics.length === 0) {
                    diagnostics = program.getSemanticDiagnostics();
                }
            }
            reportDiagnostics(diagnostics, compilerHost);

            //const emitOutput = program.emit();
            //diagnostics = diagnostics.concat(emitOutput.diagnostics);
        }
    }
}