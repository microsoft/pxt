/// <reference path="../../node_modules/typescript/lib/typescriptServices.d.ts"/>

// Enforce order:
/// <reference path="util.ts"/>
/// <reference path="cloud.ts"/>
/// <reference path="thumb.ts"/>
/// <reference path="emitter.ts"/>

namespace ts.mbit {
    export interface CompileOptions {
        fileSystem: StringMap<string>;
        sourceFiles?: string[];
        hexinfo: any;
        noEmit?: boolean;
    }

    export interface CompileResult {
        outfiles: StringMap<string>;
        diagnostics: Diagnostic[];
        success: boolean;
        times:Util.StringMap<number>;
    }

    export function getTsCompilerOptions(opts: CompileOptions) {
        let options = ts.getDefaultCompilerOptions()

        options.target = ScriptTarget.ES5;
        options.module = ModuleKind.None;
        options.noImplicitAny = true;
        options.noImplicitReturns = true;

        return options
    }

    export function patchUpDiagnostics(diags: Diagnostic[]) {
        let highPri = diags.filter(d => d.code == 1148)
        if (highPri.length > 0)
            diags = highPri;
        return diags.map(d => {
            d = Util.flatClone(d)
            if (d.code == 1148)
                d.messageText = Util.lf("all symbols in top-level scope are always exported; please use a namespace if you want to export only some")
            return d
        })
    }

    export function compile(opts: CompileOptions) {
        let startTime = Date.now()
        let res: CompileResult = {
            outfiles: {},
            diagnostics: [],
            success: false,
            times: {}
        }

        let fileText = opts.fileSystem
        let setParentNodes = true
        let options = getTsCompilerOptions(opts)

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
        
        let emitStart = Date.now()
        res.times["typescript"] = emitStart - startTime 

        if (res.diagnostics.length == 0) {
            const mbitOutput = emitMBit(program, host, opts);
            res.times["emitmbit"] = Date.now() - emitStart
            res.diagnostics = mbitOutput.diagnostics
        }

        res.diagnostics = patchUpDiagnostics(res.diagnostics)

        if (res.diagnostics.length == 0)
            res.success = true
        return res
    }
}
