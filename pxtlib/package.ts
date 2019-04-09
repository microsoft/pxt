/// <reference path="../localtypings/pxtpackage.d.ts"/>
/// <reference path="../localtypings/pxtparts.d.ts"/>
/// <reference path="../localtypings/pxtarget.d.ts"/>
/// <reference path="util.ts"/>

namespace pxt {
    export class Package {
        static getConfigAsync(pkgTargetVersion: string, id: string, fullVers: string): Promise<pxt.PackageConfig> {
            return Promise.resolve().then(() => {
                if (pxt.github.isGithubId(fullVers)) {
                    const repoInfo = pxt.github.parseRepoId(fullVers);
                    return pxt.packagesConfigAsync()
                        .then(config => pxt.github.repoAsync(repoInfo.fullName, config))    // Make sure repo exists and is whitelisted
                        .then(gitRepo => gitRepo ? pxt.github.pkgConfigAsync(repoInfo.fullName, repoInfo.tag) : null);
                } else {
                    // If it's not from GH, assume it's a bundled package
                    // TODO: Add logic for shared packages if we enable that
                    const updatedRef = pxt.patching.upgradePackageReference(pkgTargetVersion, id, fullVers);
                    const bundledPkg = pxt.appTarget.bundledpkgs[updatedRef];
                    return JSON.parse(bundledPkg[CONFIG_NAME]) as pxt.PackageConfig;
                }
            });
        }

        static corePackages(): pxt.PackageConfig[] {
            const pkgs = pxt.appTarget.bundledpkgs;
            return Object.keys(pkgs).map(id => JSON.parse(pkgs[id][pxt.CONFIG_NAME]) as pxt.PackageConfig)
                .filter(cfg => !!cfg);
        }

        public addedBy: Package[];
        public config: PackageConfig;
        public level = -1; // main package = 0, first children = 1, etc
        public isLoaded = false;
        private resolvedVersion: string;
        public ignoreTests = false;
        public cppOnly = false;

        constructor(public id: string, public _verspec: string, public parent: MainPackage, addedBy: Package) {
            if (addedBy) {
                this.level = addedBy.level + 1
            }

            this.addedBy = [addedBy];
        }

        invalid(): boolean {
            return /^invalid:/.test(this.version());
        }

        version() {
            return this.resolvedVersion || this._verspec;
        }

        verProtocol() {
            let spl = this.version().split(':')
            if (spl.length > 1) return spl[0]
            else return ""
        }

        verArgument() {
            let p = this.verProtocol()
            if (p) return this.version().slice(p.length + 1)
            return this.version()
        }

        targetVersion(): string {
            return (this.parent && this.parent != <Package>this)
                ? this.parent.targetVersion()
                : this.config.targetVersions
                    ? this.config.targetVersions.target
                    : undefined;
        }

        commonDownloadAsync(): Promise<Map<string>> {
            let proto = this.verProtocol()
            if (proto == "pub") {
                return Cloud.downloadScriptFilesAsync(this.verArgument())
            } else if (proto == "github") {
                return pxt.packagesConfigAsync()
                    .then(config => pxt.github.downloadPackageAsync(this.verArgument(), config))
                    .then(resp => resp.files)
            } else if (proto == "embed") {
                let resp = pxt.getEmbeddedScript(this.verArgument())
                return Promise.resolve(resp)
            } else
                return Promise.resolve(null as Map<string>)
        }

        host() { return this.parent._host }

        readFile(fn: string) {
            return this.host().readFile(this, fn)
        }

        resolveDep(id: string) {
            if (this.parent.deps.hasOwnProperty(id))
                return this.parent.deps[id];
            return null
        }

        saveConfig() {
            const cfg = U.clone(this.config)
            delete cfg.additionalFilePaths
            const text = JSON.stringify(cfg, null, 4)
            this.host().writeFile(this, pxt.CONFIG_NAME, text)
        }

        setPreferredEditor(editor: string) {
            if (this.config.preferredEditor != editor) {
                this.config.preferredEditor = editor
                this.saveConfig()
            }
        }

        getPreferredEditor() {
            let editor = this.config.preferredEditor
            if (!editor) {
                // older editors do not have this field set so we need to apply our
                // language resolution logic here
                // note that the preferredEditor field will be set automatically on the first save

                // 1. no main.blocks in project, open javascript
                const hasMainBlocks = this.getFiles().indexOf("main.blocks") >= 0;
                if (!hasMainBlocks)
                    return pxt.JAVASCRIPT_PROJECT_NAME;

                // 2. if main.blocks is empty and main.ts is non-empty
                //    open typescript
                // https://github.com/Microsoft/pxt/blob/master/webapp/src/app.tsx#L1032
                const mainBlocks = this.readFile("main.blocks");
                const mainTs = this.readFile("main.ts");
                if (!mainBlocks && mainTs)
                    return pxt.JAVASCRIPT_PROJECT_NAME;

                // 3. default ot blocks
                return pxt.BLOCKS_PROJECT_NAME;
            }
            return editor
        }

        parseJRes(allres: Map<JRes> = {}) {
            for (const f of this.getFiles()) {
                if (U.endsWith(f, ".jres")) {
                    let js: Map<JRes> = JSON.parse(this.readFile(f))
                    let base = js["*"]
                    for (let k of Object.keys(js)) {
                        if (k == "*") continue
                        let v = js[k]
                        if (typeof v == "string") {
                            // short form
                            v = { data: v } as any
                        }
                        let ns = v.namespace || base.namespace || ""
                        if (ns) ns += "."
                        let id = v.id || ns + k
                        let icon = v.icon
                        let mimeType = v.mimeType || base.mimeType
                        let dataEncoding = v.dataEncoding || base.dataEncoding || "base64"
                        if (!icon && dataEncoding == "base64" && (mimeType == "image/png" || mimeType == "image/jpeg")) {
                            icon = "data:" + mimeType + ";base64," + v.data
                        }
                        allres[id] = {
                            id,
                            data: v.data,
                            dataEncoding: v.dataEncoding || base.dataEncoding || "base64",
                            icon,
                            namespace: ns,
                            mimeType
                        }
                    }
                }
            }
            return allres
        }

        private resolveVersionAsync() {
            let v = this._verspec

            if (getEmbeddedScript(this.id)) {
                this.resolvedVersion = v = "embed:" + this.id
            } else if (!v || v == "*") {
                // don't hard crash, instead ignore dependency
                // U.userError(lf("version not specified for {0}", this.id))
                this.configureAsInvalidPackage(lf("version not specified for {0}", this.id));
                v = this._verspec;
            }
            return Promise.resolve(v)
        }

        private downloadAsync() {
            return this.resolveVersionAsync()
                .then(verNo => {
                    if (this.invalid()) {
                        pxt.debug(`skip download of invalid package ${this.id}`);
                        return undefined;
                    }
                    if (!/^embed:/.test(verNo) &&
                        this.config && this.config.installedVersion == verNo)
                        return undefined;
                    pxt.debug('downloading ' + verNo)
                    return this.host().downloadPackageAsync(this)
                        .then(() => {
                            this.loadConfig();
                            pxt.debug(`installed ${this.id} /${verNo}`)
                        })

                })
        }

        loadConfig() {
            const confStr = this.readFile(pxt.CONFIG_NAME)
            if (!confStr)
                U.userError(`extension ${this.id} is missing ${pxt.CONFIG_NAME}`)
            this.parseConfig(confStr);
            if (this.level != 0)
                this.config.installedVersion = this.version()
            this.saveConfig()
        }

        protected validateConfig() {
            if (!this.config.dependencies)
                U.userError("Missing dependencies in config of: " + this.id)
            if (!Array.isArray(this.config.files))
                U.userError("Missing files in config of: " + this.id)
            if (typeof this.config.name != "string" || !this.config.name ||
                (this.config.public && !/^[a-z][a-z0-9\-_]+$/i.test(this.config.name)))
                U.userError("Invalid extension name: " + this.config.name)
            if (this.config.targetVersions
                && this.config.targetVersions.target
                && semver.majorCmp(this.config.targetVersions.target, appTarget.versions.target) > 0)
                U.userError(lf("{0} requires target version {1} (you are running {2})",
                    this.config.name, this.config.targetVersions.target, appTarget.versions.target))
        }

        isPackageInUse(pkgId: string, ts: string = this.readFile("main.ts")): boolean {
            // Build the RegExp that will determine whether the dependency is in use. Try to use upgrade rules,
            // otherwise fallback to the package's name
            let regex: RegExp = null;
            const upgrades = pxt.patching.computePatches(this.targetVersion(), "missingPackage");
            if (upgrades) {
                upgrades.forEach((rule) => {
                    Object.keys(rule.map).forEach((match) => {
                        if (rule.map[match] === pkgId) {
                            regex = new RegExp(match, "g");
                        }
                    });
                });
            }
            if (!regex) {
                regex = new RegExp(pkgId + "\\.", "g");
            }
            return regex.test(ts);
        }

        private getMissingPackages(config: pxt.PackageConfig, ts: string): Map<string> {
            const upgrades = pxt.patching.computePatches(this.targetVersion(), "missingPackage");
            const missing: Map<string> = {};
            if (ts && upgrades)
                upgrades.forEach(rule => {
                    Object.keys(rule.map).forEach(match => {
                        const regex = new RegExp(match, 'g');
                        const pkg = rule.map[match];
                        ts.replace(regex, (m) => {
                            if (!config.dependencies[pkg]) {
                                missing[pkg] = "*";
                            }
                            return "";
                        })
                    });
                })
            return missing;
        }

        /**
         * For the given package config or ID, looks through all the currently installed packages to find conflicts in
         * Yotta settings and version spec
         */
        findConflictsAsync(pkgOrId: string | PackageConfig, version: string): Promise<cpp.PkgConflictError[]> {
            let conflicts: cpp.PkgConflictError[] = [];
            let pkgCfg: PackageConfig;
            return Promise.resolve()
                .then(() => {
                    // Get the package config if it's not already provided
                    if (typeof pkgOrId === "string") {
                        return Package.getConfigAsync(this.targetVersion(), pkgOrId, version);
                    } else {
                        return Promise.resolve(pkgOrId as PackageConfig);
                    }
                })
                .then((cfg) => {
                    pkgCfg = cfg;
                    // Iterate through all installed packages and check for conflicting settings
                    if (pkgCfg) {
                        const yottaCfg = pkgCfg.yotta ? U.jsonFlatten(pkgCfg.yotta.config) : null;
                        this.parent.sortedDeps().forEach((depPkg) => {
                            if (pkgCfg.core && depPkg.config.core &&
                                pkgCfg.name != depPkg.config.name) {
                                const conflict = new cpp.PkgConflictError(lf("conflict between core extensions {0} and {1}", pkgCfg.name, depPkg.id));
                                conflict.pkg0 = depPkg;
                                conflicts.push(conflict);
                                return;
                            }
                            let foundYottaConflict = false;
                            if (yottaCfg) {
                                const depConfig = depPkg.config || JSON.parse(depPkg.readFile(CONFIG_NAME)) as PackageConfig;
                                const hasYottaSettings = !!depConfig && !!depConfig.yotta && !!depPkg.config.yotta.config;
                                if (hasYottaSettings) {
                                    const depYottaCfg = U.jsonFlatten(depConfig.yotta.config);
                                    for (const settingName of Object.keys(yottaCfg)) {
                                        const depSetting = depYottaCfg[settingName];
                                        const isJustDefaults = pkgCfg.yotta.configIsJustDefaults || depConfig.yotta.configIsJustDefaults;
                                        if (depYottaCfg.hasOwnProperty(settingName) && depSetting !== yottaCfg[settingName] && !isJustDefaults && (!depPkg.parent.config.yotta || !depPkg.parent.config.yotta.ignoreConflicts)) {
                                            const conflict = new cpp.PkgConflictError(lf("conflict on yotta setting {0} between extensions {1} and {2}", settingName, pkgCfg.name, depPkg.id));
                                            conflict.pkg0 = depPkg;
                                            conflict.settingName = settingName;
                                            conflicts.push(conflict);
                                            foundYottaConflict = true;
                                        }
                                    }
                                }
                            }
                            if (!foundYottaConflict && pkgCfg.name === depPkg.id && depPkg._verspec != version && !/^file:/.test(depPkg._verspec) && !/^file:/.test(version)) {
                                const conflict = new cpp.PkgConflictError(lf("version mismatch for extension {0} (installed: {1}, installing: {2})", depPkg, depPkg._verspec, version));
                                conflict.pkg0 = depPkg;
                                conflict.isVersionConflict = true;
                                conflicts.push(conflict);
                            }
                        });
                    }
                    // Also check for conflicts for all the specified package's dependencies (recursively)
                    return Object.keys(pkgCfg.dependencies).reduce((soFar, pkgDep) => {
                        return soFar
                            .then(() => this.findConflictsAsync(pkgDep, pkgCfg.dependencies[pkgDep]))
                            .then((childConflicts) => conflicts.push.apply(conflicts, childConflicts));
                    }, Promise.resolve());
                })
                .then(() => {
                    // For each conflicting package, we need to include their ancestor tree in the list of conflicts
                    // For example, if package A depends on package B, and package B is in conflict with package C,
                    // then package A is also technically in conflict with C
                    const allAncestors = (p: Package): Package[] => {
                        const ancestors: Package[] = [];
                        p.addedBy.forEach((a) => {
                            if (a.id !== this.id) {
                                ancestors.push.apply(allAncestors(a));
                                ancestors.push(a);
                            }
                        });
                        return ancestors;
                    }
                    const additionalConflicts: cpp.PkgConflictError[] = [];
                    conflicts.forEach((c) => {
                        additionalConflicts.push.apply(additionalConflicts, allAncestors(c.pkg0).map((anc) => {
                            const confl = new cpp.PkgConflictError(c.isVersionConflict ?
                                lf("a dependency of {0} has a version mismatch with extension {1} (installed: {1}, installing: {2})", anc.id, pkgCfg.name, c.pkg0._verspec, version) :
                                lf("conflict on yotta setting {0} between extensions {1} and {2}", c.settingName, pkgCfg.name, c.pkg0.id));
                            confl.pkg0 = anc;
                            return confl;
                        }));
                    });
                    conflicts.push.apply(conflicts, additionalConflicts);

                    // Remove duplicate conflicts (happens if more than one package had the same ancestor)
                    conflicts = conflicts.filter((c, index) => {
                        for (let i = 0; i < index; ++i) {
                            if (c.pkg0.id === conflicts[i].pkg0.id) {
                                return false;
                            }
                        }
                        return true;
                    });

                    return conflicts;
                });
        }

        public configureAsInvalidPackage(reason: string) {
            pxt.log(`invalid package ${this.id}: ${reason}`);
            this._verspec = "invalid:" + this.id;
            this.config = <PackageConfig>{
                name: this.id,
                description: reason,
                dependencies: {},
                files: []
            }
        }

        private parseConfig(cfgSrc: string, targetVersion?: string) {
            try {
                const cfg = <PackageConfig>JSON.parse(cfgSrc);
                this.config = cfg;
            } catch (e) {
                this.configureAsInvalidPackage(lf("Syntax error in pxt.json"));
            }

            const currentConfig = JSON.stringify(this.config);
            for (const dep in this.config.dependencies) {
                const value = pxt.patching.upgradePackageReference(this.targetVersion(), dep, this.config.dependencies[dep]);
                if (value != dep) {
                    delete this.config.dependencies[dep];
                    if (value) {
                        this.config.dependencies[value] = "*";
                    }
                }
            }
            if (targetVersion) {
                this.config.targetVersions = {
                    target: targetVersion
                };
            }
            if (JSON.stringify(this.config) != currentConfig) {
                this.saveConfig();
            }
            this.validateConfig();
        }

        private patchCorePackage() {
            Util.assert(appTarget.simulator && appTarget.simulator.dynamicBoardDefinition);
            Util.assert(this.level == 0);

            // find all core packages in target
            const corePackages = Object.keys(this.config.dependencies)
                .filter(dep => !!dep && (
                    dep == pxt.BLOCKS_PROJECT_NAME || dep == pxt.JAVASCRIPT_PROJECT_NAME ||
                    (<pxt.PackageConfig>JSON.parse((pxt.appTarget.bundledpkgs[dep] || {})[pxt.CONFIG_NAME] || "{}").core)
                ));
            // no core package? add the first one
            if (corePackages.length == 0) {
                const allCorePkgs = pxt.Package.corePackages();
                /* tslint:disable:no-unused-expression TODO(tslint): */
                if (allCorePkgs.length)
                    this.config.dependencies[allCorePkgs[0].name];
                /* tslint:enable:no-unused-expression */
            } else if (corePackages.length > 1) {
                // keep last package
                corePackages.pop();
                corePackages.forEach(dep => {
                    pxt.log(`removing core package ${dep}`)
                    delete this.config.dependencies[dep];
                });
            }
        }

        dependencies(includeCpp = false): pxt.Map<string> {
            if (!this.config) return {};

            const dependencies = Util.clone(this.config.dependencies || {});
            // add test dependencies if nedeed
            if (this.level == 0 && this.config.testDependencies) {
                Util.jsonMergeFrom(dependencies, this.config.testDependencies);
            }
            if (includeCpp && this.config.cppDependencies) {
                Util.jsonMergeFrom(dependencies, this.config.cppDependencies);
            }
            return dependencies;
        }

        loadAsync(isInstall = false, targetVersion?: string): Promise<void> {
            if (this.isLoaded) return Promise.resolve();

            let initPromise = Promise.resolve()

            if (this.level == 0)
                pxt.setAppTargetVariant(null)

            this.isLoaded = true;
            const str = this.readFile(pxt.CONFIG_NAME);
            if (str == null) {
                if (!isInstall)
                    U.userError("Package not installed: " + this.id + ", did you forget to run `pxt install`?")
            } else {
                initPromise = initPromise.then(() => this.parseConfig(str))
            }

            if (isInstall)
                initPromise = initPromise.then(() => this.downloadAsync())

            if (appTarget.simulator && appTarget.simulator.dynamicBoardDefinition) {
                if (this.level == 0)
                    initPromise = initPromise.then(() => this.patchCorePackage());
                initPromise = initPromise.then(() => {
                    if (this.config.compileServiceVariant)
                        pxt.setAppTargetVariant(this.config.compileServiceVariant)
                    if (this.config.files.indexOf("board.json") < 0) return
                    const def = appTarget.simulator.boardDefinition = JSON.parse(this.readFile("board.json")) as pxsim.BoardDefinition;
                    def.id = this.config.name;
                    appTarget.appTheme.boardName = def.boardName || lf("board");
                    appTarget.appTheme.driveDisplayName = def.driveDisplayName || lf("DRIVE");
                    let expandPkg = (v: string) => {
                        let m = /^pkg:\/\/(.*)/.exec(v)
                        if (m) {
                            let fn = m[1]
                            let content = this.readFile(fn)
                            return U.toDataUri(content, U.getMime(fn))
                        } else {
                            return v
                        }
                    }
                    let bd = appTarget.simulator.boardDefinition
                    if (typeof bd.visual == "object") {
                        let vis = bd.visual as pxsim.BoardImageDefinition
                        vis.image = expandPkg(vis.image)
                        vis.outlineImage = expandPkg(vis.outlineImage)
                    }
                })
            }


            const loadDepsRecursive = (deps: pxt.Map<string>, from: Package, isCpp = false) => {
                return U.mapStringMapAsync(deps || from.dependencies(isCpp), (id, ver) => {
                    if (id == "hw" && pxt.hwVariant)
                        id = "hw---" + pxt.hwVariant
                    let mod = from.resolveDep(id)
                    ver = ver || "*"
                    if (mod) {
                        if (mod.invalid()) {
                            // failed to resolve dependency, ignore
                            mod.level = Math.min(mod.level, from.level + 1)
                            mod.addedBy.push(from)
                            return Promise.resolve();
                        }

                        if (mod._verspec != ver && !/^file:/.test(mod._verspec) && !/^file:/.test(ver))
                            U.userError("Version spec mismatch on " + id)
                        if (!isCpp) {
                            mod.level = Math.min(mod.level, from.level + 1)
                            mod.addedBy.push(from)
                        }
                        return Promise.resolve()
                    } else {
                        let mod = new Package(id, ver, from.parent, from)
                        if (isCpp)
                            mod.cppOnly = true
                        from.parent.deps[id] = mod
                        // we can have "core---nrf52" to be used instead of "core" in other packages
                        from.parent.deps[id.replace(/---.*/, "")] = mod
                        return mod.loadAsync(isInstall)
                    }
                })
            }

            return initPromise
                .then(() => loadDepsRecursive(null, this))
                .then(() => {
                    // get paletter config loading deps, so the more higher level packages take precedence
                    if (this.config.palette && appTarget.runtime)
                        appTarget.runtime.palette = U.clone(this.config.palette)
                    // get screen size loading deps, so the more higher level packages take precedence
                    if (this.config.screenSize && appTarget.runtime)
                        appTarget.runtime.screenSize = U.clone(this.config.screenSize);

                    if (this.level === 0) {
                        // Check for missing packages. We need to add them 1 by 1 in case they conflict with eachother.
                        const mainTs = this.readFile("main.ts");
                        if (!mainTs) return Promise.resolve(null);

                        const missingPackages = this.getMissingPackages(this.config, mainTs);
                        let didAddPackages = false;
                        let addPackagesPromise = Promise.resolve();
                        Object.keys(missingPackages).reduce((addPackagesPromise, missing) => {
                            return addPackagesPromise
                                .then(() => this.findConflictsAsync(missing, missingPackages[missing]))
                                .then((conflicts) => {
                                    if (conflicts.length) {
                                        const conflictNames = conflicts.map((c) => c.pkg0.id).join(", ");
                                        const settingNames = conflicts.map((c) => c.settingName).filter((s) => !!s).join(", ");
                                        pxt.log(`skipping missing package ${missing} because it conflicts with the following packages: ${conflictNames} (conflicting settings: ${settingNames})`);
                                        return Promise.resolve(null);
                                    } else {
                                        pxt.log(`adding missing package ${missing}`);
                                        didAddPackages = true;
                                        this.config.dependencies[missing] = "*"
                                        const addDependency: Map<string> = {};
                                        addDependency[missing] = missingPackages[missing];
                                        return loadDepsRecursive(addDependency, this);
                                    }
                                });
                        }, Promise.resolve(null))
                            .then(() => {
                                if (didAddPackages) {
                                    this.saveConfig();
                                    this.validateConfig();
                                }
                                return Promise.resolve(null);
                            });
                    }
                    return Promise.resolve(null);
                })
                .then<any>(() => {
                    if (this.level != 0)
                        return Promise.resolve()
                    return Promise.all(U.values(this.parent.deps).map(pkg =>
                        loadDepsRecursive(null, pkg, true)))
                })
                .then(() => {
                    pxt.debug(`  installed ${this.id}`)
                });
        }

        getFiles() {
            if (this.level == 0 && !this.ignoreTests)
                return this.config.files.concat(this.config.testFiles || [])
            else
                return this.config.files.slice(0);
        }

        addSnapshot(files: Map<string>, exts: string[] = [""]) {
            for (let fn of this.getFiles()) {
                if (exts.some(e => U.endsWith(fn, e))) {
                    files[this.id + "/" + fn] = this.readFile(fn)
                }
            }
            files[this.id + "/" + pxt.CONFIG_NAME] = this.readFile(pxt.CONFIG_NAME)
        }

        /**
         * Returns localized strings qName -> translation
         */
        packageLocalizationStringsAsync(lang: string): Promise<Map<string>> {
            const targetId = pxt.appTarget.id;
            const filenames = [this.id + "-jsdoc", this.id];
            const r: Map<string> = {};
            const theme = pxt.appTarget.appTheme || {};

            if (this.config.skipLocalization)
                return Promise.resolve(r);

            // live loc of bundled packages
            if (pxt.Util.localizeLive && this.id != "this" && pxt.appTarget.bundledpkgs[this.id]) {
                pxt.debug(`loading live translations for ${this.id}`)
                const code = pxt.Util.userLanguage();
                return Promise.all(filenames.map(
                    fn => pxt.Util.downloadLiveTranslationsAsync(code, `${targetId}/${fn}-strings.json`, theme.crowdinBranch)
                        .then(tr => {
                            if (tr && Object.keys(tr).length) {
                                Util.jsonMergeFrom(r, tr);
                            } else {
                                pxt.tickEvent("translations.livetranslationsfailed", { "filename": fn });
                                Util.jsonMergeFrom(r, this.bundledStringsForFile(lang, fn));
                            }
                        })
                        .catch(e => {
                            pxt.tickEvent("translations.livetranslationsfailed", { "filename": fn });
                            pxt.log(`error while downloading ${targetId}/${fn}-strings.json`);
                            Util.jsonMergeFrom(r, this.bundledStringsForFile(lang, fn));
                        }))
                ).then(() => r);
            }
            else {
                filenames.map(name => {
                    return this.bundledStringsForFile(lang, name);
                }).filter(d => !!d).forEach(d => Util.jsonMergeFrom(r, d));
                return Promise.resolve(r);
            }
        }

        bundledStringsForFile(lang: string, filename: string): Map<string> {
            let r: Map<string> = {};
            const files = this.config.files;
            let fn = `_locales/${lang.toLowerCase()}/${filename}-strings.json`;
            if (files.indexOf(fn) > -1)
                r = JSON.parse(this.readFile(fn)) as Map<string>;
            if (lang.length > 2) {
                fn = `_locales/${lang.substring(0, 2).toLowerCase()}/${filename}-strings.json`;
                if (files.indexOf(fn) > -1)
                    r = JSON.parse(this.readFile(fn)) as Map<string>;
            }

            return r;
        }
    }

    export class MainPackage extends Package {
        public deps: Map<Package> = {};
        private _jres: Map<JRes>;

        constructor(public _host: Host) {
            super("this", "file:.", null, null)
            this.parent = this
            this.addedBy = [this]
            this.level = 0
            this.deps[this.id] = this;
        }

        installAllAsync(targetVersion?: string) {
            return this.loadAsync(true, targetVersion);
        }

        sortedDeps(includeCpp = false) {
            let visited: Map<boolean> = {}
            let ids: string[] = []
            const weight = (p: Package) =>
                p.config ? Object.keys(p.config.cppDependencies || {}).length : 0
            const rec = (p: Package) => {
                if (!p || U.lookup(visited, p.id)) return;
                visited[p.id] = true;

                const depNames = Object.keys(p.dependencies(includeCpp))
                const deps = depNames.map(id => this.resolveDep(id))
                // packages with more cppDependencies (core---* most likely) come first
                deps.sort((a, b) => weight(b) - weight(a) || U.strcmp(a.id, b.id))
                deps.forEach(rec)
                ids.push(p.id)
            }
            rec(this)
            return ids.map(id => this.resolveDep(id))
        }

        localizationStringsAsync(lang: string): Promise<Map<string>> {
            const loc: Map<string> = {};
            return Promise.all(Util.values(this.deps).map(dep =>
                dep.packageLocalizationStringsAsync(lang)
                    .then(depLoc => {
                        if (depLoc) // merge data
                            Object.keys(depLoc).forEach(k => {
                                if (!loc[k]) loc[k] = depLoc[k];
                            })
                    })))
                .then(() => {
                    // Subcategories and groups are translated in their respective package, but are not really APIs so
                    // there's no way for the translation to be saved with a block. To work around this, we copy the
                    // translations to the editor translations.
                    const strings = U.getLocalizedStrings();
                    Object.keys(loc).forEach((l) => {
                        if (U.startsWith(l, "{id:subcategory}") || U.startsWith(l, "{id:group}")) {
                            if (!strings[l]) {
                                strings[l] = loc[l];
                            }
                        }
                    });
                    U.setLocalizedStrings(strings);

                    return Promise.resolve(loc);
                });
        }

        getTargetOptions(): pxtc.CompileTarget {
            let res = U.clone(appTarget.compile)
            U.assert(!!res)
            return res
        }

        getJRes() {
            if (!this._jres) {
                this._jres = {}
                for (const pkg of this.sortedDeps()) {
                    pkg.parseJRes(this._jres)
                }
                const palBuf = (appTarget.runtime && appTarget.runtime.palette ? appTarget.runtime.palette : ["#000000", "#ffffff"])
                    .map(s => ("000000" + parseInt(s.replace(/#/, ""), 16).toString(16)).slice(-6))
                    .join("")
                this._jres["__palette"] = {
                    id: "__palette",
                    data: palBuf,
                    dataEncoding: "hex",
                    mimeType: "application/x-palette"
                }
            }
            return this._jres
        }

        getCompileOptionsAsync(target: pxtc.CompileTarget = this.getTargetOptions()): Promise<pxtc.CompileOptions> {
            let opts: pxtc.CompileOptions = {
                sourceFiles: [],
                fileSystem: {},
                target: target,
                hexinfo: { hex: [] },
                name: this.config ? this.config.name : ""
            }

            const generateFile = (fn: string, cont: string) => {
                if (this.config.files.indexOf(fn) < 0)
                    U.userError(lf("please add '{0}' to \"files\" in {1}", fn, pxt.CONFIG_NAME))
                cont = "// Auto-generated. Do not edit.\n" + cont + "\n// Auto-generated. Do not edit. Really.\n"
                if (this.host().readFile(this, fn, true) !== cont) {
                    pxt.debug(`updating ${fn} (size=${cont.length})...`)
                    this.host().writeFile(this, fn, cont, true)
                }
            }

            return this.loadAsync()
                .then(() => {
                    opts.target.preferredEditor = this.getPreferredEditor()
                    pxt.debug(`building: ${this.sortedDeps().map(p => p.config.name).join(", ")}`)
                    let ext = cpp.getExtensionInfo(this)
                    if (ext.shimsDTS) generateFile("shims.d.ts", ext.shimsDTS)
                    if (ext.enumsDTS) generateFile("enums.d.ts", ext.enumsDTS)
                    return (target.isNative
                        ? this.host().getHexInfoAsync(ext)
                        : Promise.resolve<pxtc.HexInfo>(null))
                        .then(inf => {
                            ext = U.flatClone(ext)
                            delete ext.compileData;
                            delete ext.generatedFiles;
                            delete ext.extensionFiles;
                            opts.extinfo = ext
                            opts.hexinfo = inf
                        })
                })
                .then(() => this.config.binaryonly || appTarget.compile.shortPointers || !opts.target.isNative ? null : this.filesToBePublishedAsync(true))
                .then(files => {
                    if (files) {
                        const headerString = JSON.stringify({
                            name: this.config.name,
                            comment: this.config.description,
                            status: "unpublished",
                            scriptId: this.config.installedVersion,
                            cloudId: pxt.CLOUD_ID + appTarget.id,
                            editor: this.getPreferredEditor(),
                            targetVersions: pxt.appTarget.versions
                        })
                        const programText = JSON.stringify(files)
                        return lzmaCompressAsync(headerString + programText)
                            .then(buf => {
                                if (buf) {
                                    opts.embedMeta = JSON.stringify({
                                        compression: "LZMA",
                                        headerSize: headerString.length,
                                        textSize: programText.length,
                                        name: this.config.name,
                                        eURL: pxt.appTarget.appTheme.embedUrl,
                                        eVER: pxt.appTarget.versions ? pxt.appTarget.versions.target : "",
                                        pxtTarget: appTarget.id,
                                    })
                                    opts.embedBlob = ts.pxtc.encodeBase64(U.uint8ArrayToString(buf))
                                }
                            });
                    } else {
                        return Promise.resolve()
                    }
                })
                .then(() => {
                    for (const pkg of this.sortedDeps()) {
                        for (const f of pkg.getFiles()) {
                            if (/\.(ts|asm|py)$/.test(f)) {
                                let sn = f
                                if (pkg.level > 0)
                                    sn = "pxt_modules/" + pkg.id + "/" + f
                                opts.sourceFiles.push(sn)
                                opts.fileSystem[sn] = pkg.readFile(f)
                            }
                        }
                    }
                    opts.jres = this.getJRes()
                    const functionOpts = pxt.appTarget.runtime && pxt.appTarget.runtime.functionsOptions;
                    opts.allowedArgumentTypes = functionOpts && functionOpts.extraFunctionEditorTypes && functionOpts.extraFunctionEditorTypes.map(info => info.typeName).concat("number", "boolean", "string");
                    return opts;
                })
        }

        filesToBePublishedAsync(allowPrivate = false) {
            let files: Map<string> = {};

            return this.loadAsync()
                .then(() => {
                    if (!allowPrivate && !this.config.public)
                        U.userError('Only packages with "public":true can be published')
                    let cfg = U.clone(this.config)
                    delete cfg.installedVersion
                    delete cfg.additionalFilePath
                    delete cfg.additionalFilePaths
                    if (!cfg.targetVersions) cfg.targetVersions = pxt.appTarget.versions;
                    U.iterMap(cfg.dependencies, (k, v) => {
                        if (!v || /^file:/.test(v) || /^workspace:/.test(v)) {
                            v = "*"
                            try {
                                let d = this.resolveDep(k)
                                let gitjson = JSON.parse(d.readFile(pxt.github.GIT_JSON) || "{}") as pxt.github.GitJson
                                if (gitjson.repo) {
                                    let parsed = pxt.github.parseRepoId(gitjson.repo)
                                    parsed.tag = gitjson.commit.tag || gitjson.commit.sha
                                    v = pxt.github.stringifyRepo(parsed)
                                }
                            } catch (e) { }
                            cfg.dependencies[k] = v
                        }
                    })
                    files[pxt.CONFIG_NAME] = JSON.stringify(cfg, null, 4)
                    for (let f of this.getFiles()) {
                        // already stored
                        if (f == pxt.CONFIG_NAME) continue;
                        let str = this.readFile(f)
                        if (str == null)
                            U.userError("referenced file missing: " + f)
                        files[f] = str
                    }

                    return U.sortObjectFields(files)
                })
        }

        saveToJsonAsync(): Promise<pxt.cpp.HexFile> {
            return this.filesToBePublishedAsync(true)
                .then(files => {
                    const project: pxt.cpp.HexFile = {
                        meta: {
                            cloudId: pxt.CLOUD_ID + pxt.appTarget.id,
                            targetVersions: pxt.appTarget.versions,
                            editor: this.getPreferredEditor(),
                            name: this.config.name
                        },
                        source: JSON.stringify(files, null, 2)
                    }
                    return project;
                });
        }

        compressToFileAsync(): Promise<Uint8Array> {
            return this.saveToJsonAsync()
                .then(project => pxt.lzmaCompressAsync(JSON.stringify(project, null, 2)));
        }

        computePartDefinitions(parts: string[]): pxt.Map<pxsim.PartDefinition> {
            if (!parts || !parts.length) return {};

            let res: pxt.Map<pxsim.PartDefinition> = {};
            this.sortedDeps().forEach(d => {
                let pjson = d.readFile("pxtparts.json");
                if (pjson) {
                    try {
                        let p = JSON.parse(pjson) as pxt.Map<pxsim.PartDefinition>;
                        Object.keys(p).forEach(k => {
                            if (parts.indexOf(k) >= 0) {
                                let part = res[k] = p[k];
                                if (typeof part.visual.image === "string" && /\.svg$/i.test(part.visual.image)) {
                                    let f = d.readFile(part.visual.image);
                                    if (!f) pxt.reportError("parts", "invalid part definition", { "error": `missing visual ${part.visual.image}` })
                                    part.visual.image = `data:image/svg+xml,` + encodeURIComponent(f);
                                }
                            }
                        });
                    } catch (e) {
                        pxt.reportError("parts", "invalid pxtparts.json file");
                    }
                }
            })
            return res;
        }
    }

    export function allPkgFiles(cfg: PackageConfig) {
        return [pxt.CONFIG_NAME].concat(cfg.files || []).concat(cfg.testFiles || [])
    }

    export function isPkgBeta(cfg: { description?: string; }): boolean {
        return cfg && /\bbeta\b/.test(cfg.description);
    }
}