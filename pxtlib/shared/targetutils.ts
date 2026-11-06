/// <reference path="../../localtypings/pxtarget.d.ts"/>
/// <reference path="../commonutil.ts"/>

namespace pxt {
    /** Resolves compile defaults and a variant without modifying the supplied target. */
    export function getAppTargetVariant(target: TargetBundle, variant: string): TargetBundle {
        const result = U.cloneTargetBundle(target);
        if (variant) {
            const overrides = result.variants && result.variants[variant];
            if (!overrides)
                U.userError(U.lf("Variant '{0}' not defined in pxtarget.json", variant));
            U.jsonMergeFrom(result, overrides);
        }
        patchCompileTarget(result);
        return result;
    }

    export function patchCompileTarget(target: AppTarget): void {
        let comp = target.compile
        if (!comp)
            comp = target.compile = { isNative: false, hasHex: false, switches: {} }
        if (comp.hasHex) {
            if (!comp.nativeType)
                comp.nativeType = pxtc.NATIVE_TYPE_THUMB
        }
        if (!comp.switches)
            comp.switches = {}
        if (comp.nativeType == pxtc.NATIVE_TYPE_VM)
            comp.sourceMap = true
        // JS ref counting currently not supported
        comp.jsRefCounting = false
        if (!comp.useUF2 && !comp.useELF && comp.noSourceInFlash == undefined)
            comp.noSourceInFlash = true // no point putting sources in hex to be flashed
        if (comp.utf8 === undefined)
            comp.utf8 = true
        let cs = target.compileService
        if (cs) {
            if (cs.yottaTarget && !cs.yottaBinary)
                cs.yottaBinary = "pxt-microbit-app-combined.hex"
        }
    }
}

namespace ts.pxtc.Util {
    export function cloneTargetBundle(target: pxt.TargetBundle) {
        target = {
            ...target
        };

        const apiInfo = target.apiInfo;
        delete target.apiInfo;

        const bundleddirs = target.bundleddirs;
        delete target.bundleddirs;

        const bundledpkgs = target.bundledpkgs;
        delete target.bundledpkgs;

        const tutorialInfo = target.tutorialInfo;
        delete target.tutorialInfo;

        const res = clone(target);

        if (apiInfo) {
            res.apiInfo = {};
            for (const key of Object.keys(apiInfo)) {
                const apis = apiInfo[key].apis;

                res.apiInfo[key] = {
                    sha: apiInfo[key].sha,
                    apis: {
                        jres: { ...apis.jres },
                        byQName: cloneApis(apis.byQName)
                    }
                }
            }
        }

        if (bundleddirs) {
            res.bundleddirs = [...bundleddirs]
        }

        if (bundledpkgs) {
            res.bundledpkgs = {};
            for (const key of Object.keys(bundledpkgs)) {
                res.bundledpkgs[key] = {
                    ...bundledpkgs[key]
                };
            }
        }

        if (tutorialInfo) {
            res.tutorialInfo = {};

            for (const key of Object.keys(tutorialInfo)) {
                const built = tutorialInfo[key];

                res.tutorialInfo[key] = {
                    hash: built.hash,
                    usedBlocks: {
                        ...built.usedBlocks
                    },
                    snippetBlocks: {
                        ...built.snippetBlocks
                    },
                    highlightBlocks: {
                        ...built.highlightBlocks
                    },
                    validateBlocks: {
                        ...built.validateBlocks
                    },
                }
            }
        }

        return res;
    }

    export function cloneApis(byQName: pxt.Map<pxtc.SymbolInfo>) {
        const res: pxt.Map<pxtc.SymbolInfo> = {};

        for (const key of Object.keys(byQName)) {
            res[key] = cloneSymbolInfo(byQName[key]);
        }

        return res;
    }

    export function cloneSymbolInfo(sym: pxtc.SymbolInfo): pxtc.SymbolInfo {
        return {
            // FIXME: This is a little dangerous, because we do edit the symbol attributes in some places
            // for localization. However, most of those edits are to top-level properties and only edits
            // to child objects matter so it *should* be fine
            attributes: {
                ...sym.attributes
            },

            parameters: sym.parameters?.map(cloneParameterDesc),
            extendsTypes: sym.extendsTypes ? [...sym.extendsTypes] : undefined,
            pkgs: sym.pkgs ? [...sym.pkgs] : undefined,
            combinedProperties: sym.combinedProperties ? [...sym.combinedProperties] : undefined,

            name: sym.name,
            namespace: sym.namespace,
            fileName: sym.fileName,
            kind: sym.kind,
            retType: sym.retType,
            isInstance: sym.isInstance,
            isContextual: sym.isContextual,
            qName: sym.qName,
            pkg: sym.pkg,
            snippet: sym.snippet,
            snippetName: sym.snippetName,
            snippetWithMarkers: sym.snippetWithMarkers,
            pySnippet: sym.pySnippet,
            pySnippetName: sym.pySnippetName,
            pySnippetWithMarkers: sym.pySnippetWithMarkers,
            blockFields: sym.blockFields,
            isReadOnly: sym.isReadOnly,
            pyName: sym.pyName,
            pyQName: sym.pyQName,
            snippetAddsDefinitions: sym.snippetAddsDefinitions,
        }
    }

    function cloneParameterDesc(param: pxtc.ParameterDesc): pxtc.ParameterDesc {
        return {
            name: param.name,
            description: param.description,
            type: param.type,
            pyTypeString: param.pyTypeString,
            initializer: param.initializer,
            default: param.default,
            properties: param.properties?.map(clonePropertyDesc),
            handlerParameters: param.handlerParameters?.map(clonePropertyDesc),
            options: param.options ? clone(param.options) : undefined,
            isEnum: param.isEnum
        }
    }

    function clonePropertyDesc(prop: pxtc.PropertyDesc): pxtc.PropertyDesc {
        return {
            name: prop.name,
            type: prop.type
        }
    }
}
