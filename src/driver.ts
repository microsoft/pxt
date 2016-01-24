/// <reference path="emitter.ts"/>

namespace ts {

    let reportDiagnostic = reportDiagnosticSimply;

    function reportDiagnostics(diagnostics: Diagnostic[], host: CompilerHost): void {
        for (const diagnostic of diagnostics) {
            reportDiagnostic(diagnostic, host);
        }
    }

    function getRelativeFileName(fileName: string, host: CompilerHost): string {
        //return host ? convertToRelativePath(fileName, host.getCurrentDirectory(), fileName => host.getCanonicalFileName(fileName)) : fileName;
        return fileName
    }

    function reportDiagnosticSimply(diagnostic: Diagnostic, host: CompilerHost): void {
        let output = "";

        if (diagnostic.file) {
            const { line, character } = getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
            const relativeFileName = getRelativeFileName(diagnostic.file.fileName, host);
            output += `${relativeFileName}(${line + 1},${character + 1}): `;
        }

        const category = DiagnosticCategory[diagnostic.category].toLowerCase();
        output += `${category} TS${diagnostic.code}: ${flattenDiagnosticMessageText(diagnostic.messageText, sys.newLine)}${sys.newLine}`;

        sys.write(output);
    }


    export function main() {
        let fileNames = process.argv.slice(2)
        let options = ts.getDefaultCompilerOptions()
       
        options.target = ScriptTarget.ES5;
        options.module = ModuleKind.CommonJS;

        let host = createCompilerHost(options, true)
        let program = createProgram(fileNames, options, host);

        let diagnostics: Diagnostic[];

        // First get and report any syntactic errors.
        diagnostics = program.getSyntacticDiagnostics();

        // If we didn't have any syntactic errors, then also try getting the global and
        // semantic errors.
        if (diagnostics.length === 0) {
            diagnostics = program.getOptionsDiagnostics().concat(program.getGlobalDiagnostics());

            if (diagnostics.length === 0) {
                diagnostics = program.getSemanticDiagnostics();
            }
        }

        if (diagnostics.length == 0) {
            const mbitOutput = emitMBit(program);
            diagnostics = mbitOutput.diagnostics
        }

        reportDiagnostics(diagnostics, host);

        return diagnostics.length
            ? ExitStatus.DiagnosticsPresent_OutputsSkipped
            : ExitStatus.Success;
    }
}

ts.main();