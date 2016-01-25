/// <reference path="emitter.ts"/>

namespace ts {

    let reportDiagnostic = reportDiagnosticSimply;

    function reportDiagnostics(diagnostics: Diagnostic[]): void {
        for (const diagnostic of diagnostics) {
            reportDiagnostic(diagnostic);
        }
    }

    function reportDiagnosticSimply(diagnostic: Diagnostic): void {
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

    type StringMap<T> = ts.thumb.StringMap<T>;

    export interface CompileOptions {
        fileSystem: StringMap<string>;
        sourceFiles?: string[];
    }

    export interface CompileResult {
        outfiles: StringMap<string>;
        diagnostics: Diagnostic[];
        success: boolean;
    }

    export function compile(opts: CompileOptions) {
        let res: CompileResult = {
            outfiles: {},
            diagnostics: [],
            success: false
        }

        let options = ts.getDefaultCompilerOptions()

        options.target = ScriptTarget.ES5;
        options.module = ModuleKind.CommonJS;
        let fileText = opts.fileSystem
        let setParentNodes = true

        let host: CompilerHost = {
            getSourceFile: (fn, v, err) => {
                let text = ""
                if (fileText.hasOwnProperty(fn)) {
                    text = fileText[fn]
                } else {
                    if (err) err("File not found: " + fn)
                }
                return createSourceFile(fn, text, v, setParentNodes)
            },
            fileExists: fn => fileText.hasOwnProperty(fn),
            getCanonicalFileName: fn => fn,
            getDefaultLibFileName: () => "no-default-lib.d.ts",
            writeFile: (fileName, data, writeByteOrderMark, onError) => {
                res.outfiles[fileName] = data
            },
            getCurrentDirectory: () => ".",
            useCaseSensitiveFileNames: () => true,
            getNewLine: () => "\n",
            readFile: fn => fileText[fn] || "",
            directoryExists: dn => true,
        }

        let program = createProgram(opts.sourceFiles || Object.keys(opts.fileSystem), options, host);

        // First get and report any syntactic errors.
        res.diagnostics = program.getSyntacticDiagnostics();
        if (res.diagnostics.length > 0) return res;

        // If we didn't have any syntactic errors, then also try getting the global and
        // semantic errors.
        res.diagnostics = program.getOptionsDiagnostics().concat(program.getGlobalDiagnostics());        

        if (res.diagnostics.length == 0) {
            res.diagnostics = program.getSemanticDiagnostics();
        }

        if (res.diagnostics.length == 0) {
            const mbitOutput = emitMBit(program, host);
            res.diagnostics = mbitOutput.diagnostics
        }

        if (res.diagnostics.length == 0)
            res.success = true
        return res
    }

    export function main() {
        let fileNames = process.argv.slice(2)

        let fs = require("fs")

        let fileText: any = {}
        fileNames.forEach(fn => {
            fileText[fn] = fs.readFileSync(fn, "utf8")
        })

        let res = compile({
            fileSystem: fileText,
            sourceFiles: fileNames
        })

        Object.keys(res.outfiles).forEach(fn =>
            fs.writeFileSync(fn, res.outfiles[fn], "utf8"))
        
        reportDiagnostics(res.diagnostics);

        return res.success ?
            ExitStatus.Success :
            ExitStatus.DiagnosticsPresent_OutputsSkipped
    }
}

ts.main();