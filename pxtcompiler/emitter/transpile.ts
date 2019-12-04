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
        outfiles: { [key: string]: string }
    }

    const mainName = (l: Lang) => `main.${l}`

    export type Lang = "py" | "blocks" | "ts"
    export interface LangEquivSet {
        comparable: { [key in Lang]: string },
        code: { [key in Lang]: string },
    }
    // a circular buffer of size MAX_CODE_EQUIVS that stores
    // sets of equivalent code files so that when we translate
    // from ts -> py -> ts we get back the same ts.
    let codeEquivalences: LangEquivSet[] = []
    const MAX_CODE_EQUIVS = 10

    function toComparable(code: string, depsKey: string): string {
        // Ignore whitespace
        code = code.replace(/\s/g, "")

        let key = code + "," + depsKey
        return key
    }
    function tryGetCachedTranspile(lang: Lang, txt: string, depsKey: string): LangEquivSet | undefined {
        let txtComp = toComparable(txt, depsKey)
        for (let eq of codeEquivalences) {
            if (eq.comparable[lang] === txtComp) {
                return eq
            }
        }
        return undefined
    }
    function cacheTranspile(lang1: Lang, lang1Txt: string, lang1Deps: string, lang2: Lang, lang2Txt: string, lang2Deps: string) {
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
            }
        }
        equiv.code[lang1] = lang1Txt
        equiv.comparable[lang1] = toComparable(lang1Txt, lang1Deps)
        equiv.code[lang2] = lang2Txt
        equiv.comparable[lang2] = toComparable(lang2Txt, lang2Deps)

        codeEquivalences.unshift(equiv)

        if (codeEquivalences.length > MAX_CODE_EQUIVS) {
            codeEquivalences.pop()
        }
    }
    function makeSuccess(l: Lang, txt: string): TranspileResult {
        let outfiles: { [key: string]: string } = {}
        outfiles[mainName(l)] = txt
        return {
            diagnostics: [],
            success: true,
            outfiles
        }
    }

    function getDependenciesKey(apisInfo?: ApisInfo): string {
        return apisInfo ? Object.keys(apisInfo.byQName).join(",") : ","
    }

    function transpileInternal(from: Lang, fromTxt: string, to: Lang, doRealTranspile: () => TranspileResult, apisInfo?: ApisInfo): TranspileResult {
        let depsKey = getDependenciesKey(apisInfo)
        let equiv = tryGetCachedTranspile(from, fromTxt, depsKey)
        if (equiv && equiv.code[to]) {
            // return from cache
            let toTxt = equiv.code[to]
            let res = makeSuccess(to, toTxt)
            return res
        }

        // not found in cache, do the compile
        let res = doRealTranspile()

        if (res.success) {
            // store the result
            let toTxt = res.outfiles[mainName(to)]
            cacheTranspile(from, fromTxt, depsKey, to, toTxt, depsKey)
        }
        return res
    }

    export function pyToTs(options: pxtc.CompileOptions, filename: string = mainName("py")): TranspileResult {
        let doRealTranspile = () => {
            return (pxt as any).py.py2ts(options) as TranspileResult
        }

        let fromTxt = options.fileSystem[filename]
        U.assert(!!fromTxt, `Missing file "${filename}" when converting from py->ts`)

        return transpileInternal("py", fromTxt, "ts", doRealTranspile, options.apisInfo)
    }

    export function tsToPy(program: ts.Program, filename: string = mainName("ts")): TranspileResult {
        let doRealTranspile = () => {
            return (pxt as any).py.decompileToPython(program, filename) as TranspileResult
        }
        let tsSrc = program.getSourceFile(filename)
        U.assert(!!tsSrc, `Missing file "${filename}" when converting from ts->py`)
        let fromTxt = tsSrc.getText()

        let apisInfo = pxtc.getApiInfo(program)

        return transpileInternal("ts", fromTxt, "py", doRealTranspile, apisInfo)
    }
}