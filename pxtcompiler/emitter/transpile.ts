// TODO: enable reference so we don't need to use: (pxt as any).py
//      the issue is that this creates a circular dependency. This
//      is easily handled if we used proper TS modules.
//// <reference path="../../built/pxtpy.d.ts"/>

// This code centralizes transpiling between typescript and python
// so that we can cache results for better performance and user
// experience (since compile -> decompile round-trips are lossy)
namespace ts.pxtc.transpile {
    export interface TranspileResult {
        diagnostics: pxtc.KsDiagnostic[],
        success: boolean,
        outfiles: { [key: string]: string },
        sourceMap: SourceInterval[]
    }

    const mainName = (l: CodeLang) => `main.${l}`

    export interface LangEquivSet {
        comparable: { [key in CodeLang]: string },
        code: { [key in CodeLang]: string },
        sourceMap: SourceInterval[]
    }
    // a circular buffer of size MAX_CODE_EQUIVS that stores
    // sets of equivalent code files so that when we translate
    // from ts -> py -> ts we get back the same ts.
    let codeEquivalences: LangEquivSet[] = []
    const MAX_CODE_EQUIVS = 10

    function toComparable(code: string): string {
        // Note that whitespace is semantic for Python
        return code
    }
    export function resetCache() {
        codeEquivalences = []
    }
    function tryGetCachedTranspile(lang: CodeLang, txt: string): LangEquivSet | undefined {
        let txtComp = toComparable(txt)
        for (let eq of codeEquivalences) {
            if (eq.comparable[lang] === txtComp) {
                return eq
            }
        }
        return undefined
    }
    function cacheTranspile(lang1: CodeLang, lang1Txt: string, lang2: CodeLang, lang2Txt: string, sourceMap: SourceInterval[]) {
        let equiv: LangEquivSet = {
            comparable: {
                "ts": undefined,
                "blocks": undefined,
                "py": undefined
            },
            code: {
                "ts": undefined,
                "blocks": undefined,
                "py": undefined
            },
            sourceMap
        }
        equiv.code[lang1] = lang1Txt
        equiv.comparable[lang1] = toComparable(lang1Txt)
        equiv.code[lang2] = lang2Txt
        equiv.comparable[lang2] = toComparable(lang2Txt)

        codeEquivalences.unshift(equiv)

        if (codeEquivalences.length > MAX_CODE_EQUIVS) {
            codeEquivalences.pop()
        }
    }
    function makeSuccess(l: CodeLang, txt: string, sourceMap: SourceInterval[]): TranspileResult {
        let outfiles: { [key: string]: string } = {}
        outfiles[mainName(l)] = txt
        return {
            diagnostics: [],
            success: true,
            outfiles,
            sourceMap
        }
    }

    function transpileInternal(from: CodeLang, fromTxt: string, to: CodeLang, doRealTranspile: () => TranspileResult): TranspileResult {
        let equiv = tryGetCachedTranspile(from, fromTxt)
        if (equiv && equiv.code[to]) {
            // return from cache
            let toTxt = equiv.code[to]
            let res = makeSuccess(to, toTxt, equiv.sourceMap)
            return res
        }

        // not found in cache, do the compile
        let res = doRealTranspile()

        if (res.success) {
            // store the result
            let toTxt = res.outfiles[mainName(to)] || ""
            cacheTranspile(from, fromTxt, to, toTxt, res.sourceMap)
        }
        return res
    }

    export function pyToTs(options: pxtc.CompileOptions, filename: string = mainName("py")): TranspileResult {
        let doRealTranspile = () => {
            return (pxt as any).py.py2ts(options) as TranspileResult
        }

        let fromTxt = options.fileSystem[filename]
        U.assert(fromTxt !== undefined && fromTxt !== null, `Missing file "${filename}" when converting from py->ts`)

        return transpileInternal("py", fromTxt, "ts", doRealTranspile)
    }

    export function tsToPy(program: ts.Program, filename: string = mainName("ts")): TranspileResult {
        let doRealTranspile = () => {
            return (pxt as any).py.decompileToPython(program, filename) as TranspileResult
        }
        let tsSrc = program.getSourceFile(filename)
        U.assert(tsSrc !== undefined && tsSrc !== null, `Missing file "${filename}" when converting from ts->py`)
        let fromTxt = tsSrc.getText()

        return transpileInternal("ts", fromTxt, "py", doRealTranspile)
    }
}