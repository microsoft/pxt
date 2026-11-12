namespace pxt.cpp {
    import U = pxtc.Util;

    export interface CompileExtProjectReq {
        files: Map<string>;
        target: string;
        variant: string;
        versions: { target: string; [key: string]: string };
    }

    export function createExtensionInfoRequest(
        files: Map<string>,
        target: TargetBundle,
        variant: string
    ): string {
        if (!target || !target.id)
            U.userError("A target ID and version are required to create an extension info request.");
        const appTarget = getAppTargetVariant(target, variant);
        const configs: Map<PackageConfig> = Object.create(null);
        const aliases: Map<string[]> = Object.create(null);
        for (const filename of Object.keys(files).sort()) {
            const match = /^(pxt_modules\/([^/]+)\/)?pxt\.json$/.exec(filename);
            if (!match) continue;
            const path = match[1] || "";
            const config = configs[path] = JSON.parse(files[filename]) as PackageConfig;
            if (!path) continue;
            for (const id of [match[2], config.name]) {
                if (!id) continue;
                for (const alias of [id, id.replace(/---.*/, "")]) {
                    const paths = aliases[alias] || (aliases[alias] = []);
                    if (paths.indexOf(path) < 0) paths.push(path);
                }
            }
        }
        const resolvePath = (id: string): string => {
            if (id == "this") return "";
            const exact = "pxt_modules/" + id + "/";
            if (configs[exact]) return exact;
            const paths = aliases[id];
            if (paths && paths.length > 1)
                U.userError(`extension ${id} matches multiple directories: ${paths.join(", ")}`);
            return paths && paths[0];
        };
        const dependencies = (path: string): Map<string> => packageUtils.getConfigDependencies(
            configs[path], !path, false, id => resolvePath(id) != null
        );
        const packages: Map<string> = Object.create(null);
        const runtimePackages: Map<boolean> = Object.create(null);
        const visit = (id: string, version: string, runtime: boolean): void => {
            const path = resolvePath(id);
            if (path == null || !configs[path])
                U.userError(`extension ${id} is missing pxt.json`);
            if (runtimePackages[path] || (!runtime && packages[path] != null)) return;
            const config = configs[path];
            if (!config.dependencies || !Array.isArray(config.files))
                U.userError(`Invalid pxt.json in extension ${id}`);
            if (runtime) runtimePackages[path] = true;
            if (packages[path] == null) {
                packageUtils.removeUnsupportedPackageConfigFields(
                    config, path + "pxt.json", message => pxt.log(message)
                );
                packages[path] = version;
            }
            const deps = dependencies(path);
            for (const dep of Object.keys(deps).sort())
                visit(dep, deps[dep], runtime);
            for (const dep of Object.keys(config.cppDependencies || {}).sort())
                visit(dep, config.cppDependencies[dep], false);
        };
        visit("this", "file:.", true);

        const requestFiles: Map<string> = {};
        const nativeDependencies: Map<string> = {};
        const forceUtf8 = !appTarget.compile.utf8 &&
            Object.keys(packages).some(path => configs[path].utf8);
        for (const path of Object.keys(packages).sort()) {
            const original = configs[path];
            const id = path ? path.slice("pxt_modules/".length, -1) : "this";

            const nativeFiles = packageUtils.getConfigFiles(
                original, !path, appTarget, dep => !!runtimePackages[resolvePath(dep)],
                condition => pxt.log(`invalid dependency expression: ${condition} in ${id}`)
            ).filter(filename => filename == "dal.d.ts" ||
                /\.(h|cpp|c|S|s|mk)$/.test(filename));

            const disabled = packageUtils.isVariantDisabled(original, variant) ||
                Object.keys(dependencies(path)).some(dep =>
                    packageUtils.isVariantDisabled(configs[resolvePath(dep)], variant));

            const config: PackageConfig = {
                name: path ? original.name : "this",
                dependencies: {},
                files: nativeFiles
            };

            if (disabled) config.disablesVariants = [variant];

            if (original.yotta) {
                const yotta = original.yotta;
                config.yotta = {
                    dependencies: yotta.dependencies,
                    config: yotta.config,
                    optionalConfig: yotta.optionalConfig,
                    configIsJustDefaults: yotta.configIsJustDefaults,
                    ignoreConflicts: yotta.ignoreConflicts
                };
            }

            if (original.codal) config.codal = original.codal;
            if (path && !nativeFiles.length && !disabled && !config.yotta && !config.codal) continue;
            if (path) nativeDependencies[id] = packages[path];
            requestFiles[path + "pxt.json"] = canonicalJson(config);
            for (const filename of nativeFiles) {
                if (files[path + filename] != null)
                    requestFiles[path + filename] = files[path + filename];
            }
        }

        // Flatten through cppDependencies so disabled transitive packages do not
        // accidentally disable the root, and runtime membership is no longer needed.
        const mainConfig = JSON.parse(requestFiles["pxt.json"]) as PackageConfig;
        mainConfig.cppDependencies = nativeDependencies;
        if (forceUtf8) mainConfig.utf8 = true;
        requestFiles["pxt.json"] = canonicalJson(mainConfig);
        return canonicalJson({
            files: requestFiles,
            target: target.id,
            versions: target.versions as CompileExtProjectReq["versions"],
            variant: variant || "",
            compileSwitches: appTarget.compile.switches
        } as CompileExtProjectReq);
    }

    function canonicalJson(value: unknown): string {
        return JSON.stringify(value, (_key, item: unknown) => {
            if (!item || typeof item != "object" || Array.isArray(item)) return item;
            const result: Map<unknown> = Object.create(null);
            for (const key of Object.keys(item).sort())
                result[key] = (item as Map<unknown>)[key];
            return result;
        });
    }

    export function injectProjectCompileData(
        extensionInfo: pxtc.ExtensionInfo,
        files: Map<string>,
        target: TargetBundle,
        variant: string
    ) {
        const data = createExtensionInfoRequest(files, target, variant);

        extensionInfo.projectCompileData = ts.pxtc.encodeBase64(U.toUTF8(data));
        extensionInfo.projectCompileSha = ts.pxtc.BrowserImpl.sha256buffer(U.toUTF8Array(data));
    }
}
