/// <reference path="../localtypings/pxtpackage.d.ts"/>
/// <reference path="../localtypings/pxtparts.d.ts"/>
/// <reference path="../localtypings/pxtarget.d.ts"/>
/// <reference path="util.ts"/>

namespace pxt {
    const CONFIG_FIELDS_ORDER = [
        "name",
        "version",
        "description",
        "license",
        "dependencies",
        "files",
        "testFiles",
        "testDependencies",
        "fileDependencies",
        "public",
        "targetVersions",
        "supportedTargets",
        "preferredEditor",
        "languageRestriction",
        "additionalFilePath",
        "additionalFilePaths"
    ]

    export class Package {

        static stringifyConfig(config: pxt.PackageConfig): string {
            // reorg fields
            const configMap: Map<string> = config as any
            const newCfg: any = {}
            for (const f of CONFIG_FIELDS_ORDER) {
                if (configMap.hasOwnProperty(f))
                    newCfg[f] = configMap[f]
            }
            for (const f of Object.keys(configMap)) {
                if (!newCfg.hasOwnProperty(f))
                    newCfg[f] = configMap[f]
            }

            // github adds a newline when web editing
            return JSON.stringify(newCfg, null, 4) + "\n"
        }

        static parseAndValidConfig(configStr: string): pxt.PackageConfig {
            const json = Util.jsonTryParse(configStr) as pxt.PackageConfig;
            return json
                && json.name !== undefined && typeof json.name === "string"
                // && json.version && typeof json.version === "string", default to 0.0.0
                && json.files && Array.isArray(json.files) && json.files.every(f => typeof f === "string")
                && json.dependencies && Object.keys(json.dependencies).every(k => typeof json.dependencies[k] === "string")
                && json;
        }

        static async getConfigAsync(pkgTargetVersion: string, id: string, fullVers: string): Promise<pxt.PackageConfig> {
            if (pxt.github.isGithubId(fullVers)) {
                const repoInfo = pxt.github.parseRepoId(fullVers);
                const packagesConfig = await pxt.packagesConfigAsync()
                const gitRepo = await pxt.github.repoAsync(repoInfo.fullName, packagesConfig)    // Make sure repo exists and is whitelisted
                return gitRepo ? await pxt.github.pkgConfigAsync(repoInfo.fullName, repoInfo.tag, packagesConfig) : null
            } else if (fullVers.startsWith("workspace:")) {
                // It's a local package
                const projId = fullVers.slice("workspace:".length);
                // TODO: Fetch pxt.json from the workspace project
                return null;
            } else if (fullVers.startsWith("pub:")) {
                const id = fullVers.slice("pub:".length);
                try {
                    const files = await Cloud.downloadScriptFilesAsync(id);
                    return JSON.parse(files[CONFIG_NAME]);
                }
                catch (e) {
                    pxt.log(`Unable to fetch files for published script '${fullVers}'`);
                    return null;
                }
            } else {
                // If it's not from GH, assume it's a bundled package
                // TODO: Add logic for shared packages if we enable that
                const updatedRef = pxt.patching.upgradePackageReference(pkgTargetVersion, id, fullVers);
                const bundledPkg = pxt.appTarget.bundledpkgs[updatedRef];
                return JSON.parse(bundledPkg[CONFIG_NAME]) as pxt.PackageConfig;
            }
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
        public installedVersion: string; // resolve version
        protected assetPackFiles: pxt.Map<string>;

        constructor(public id: string, public _verspec: string, public parent: MainPackage, addedBy: Package, public depName: string) {
            if (addedBy) {
                this.level = addedBy.level + 1
            }

            this.addedBy = [addedBy];
        }

        disablesVariant(v: string) {
            return this.config && this.config.disablesVariants && this.config.disablesVariants.indexOf(v) >= 0
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

        async commonDownloadAsync(): Promise<Map<string>> {
            const proto = this.verProtocol()
            let files: Map<string>;

            if (proto == "pub") {
                files = await Cloud.downloadScriptFilesAsync(this.verArgument())
            } else if (proto == "github") {
                const config = await pxt.packagesConfigAsync();
                const resp = await pxt.github.downloadPackageAsync(this.verArgument(), config)
                files = resp.files;
            } else if (proto == "embed") {
                files = pxt.getEmbeddedScript(this.verArgument())
            } else if (proto == "pkg") {
                // the package source is serialized in a file in the package itself
                const src = this.parent || this; // fall back to current package if no parent
                const pkgFilesSrc = src.readFile(this.verArgument());
                const pkgFilesJson = U.jsonTryParse(pkgFilesSrc) as Map<string>;
                if (!pkgFilesJson)
                    pxt.log(`unable to find ${this.verArgument()}`)
                files = pkgFilesJson
            }

            return files;
        }

        writeAssetPackFiles() {
            const config = JSON.parse(JSON.stringify(this.config)) as pxt.PackageConfig;
            config.files = config.files.filter(f => f.endsWith(".jres"));
            config.files.push("gallery.ts");
            config.dependencies = {};
            config.assetPack = true;
            this.config = config;
            this.saveConfig();

            let galleryTS = "";
            for (const file of config.files) {
                const content = this.readFile(file);
                const parsed = U.jsonTryParse(content);

                if (parsed) {
                    const [jres, ts] = pxt.emitGalleryDeclarations(parsed, this.getNamespaceName());
                    this.writeFile(file, JSON.stringify(jres, null, 4));
                    galleryTS += ts;
                }
            }
            this.writeFile("gallery.ts", galleryTS);
        }

        protected getNamespaceName() {
            let child: Package = this;
            let parent = child.addedBy[0];
            const parts: string[] = [];

            while (parent && parent !== child) {
                if (child.depName) parts.push(child.depName);
                child = parent;
                parent = child.addedBy[0];
            }

            return parts.reverse().map(n => ts.pxtc.escapeIdentifier(n)).join(".");
        }

        host() { return this.parent._host }

        readFile(fn: string) {
            return this.host().readFile(this, fn)
        }

        writeFile(fn: string, content: string) {
            this.host().writeFile(this, fn, content, true);
        }

        readGitJson(): pxt.github.GitJson {
            const gitJsonText = this.readFile(pxt.github.GIT_JSON);
            return pxt.Util.jsonTryParse(gitJsonText) as pxt.github.GitJson;
        }

        resolveDep(id: string) {
            if (this.parent.deps.hasOwnProperty(id))
                return this.parent.deps[id];
            return null
        }

        saveConfig() {
            const cfg = U.clone(this.config)
            delete cfg.additionalFilePaths
            const text = pxt.Package.stringifyConfig(cfg);
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
                const hasMainBlocks = this.getFiles().indexOf(pxt.MAIN_BLOCKS) >= 0;
                if (!hasMainBlocks)
                    return pxt.JAVASCRIPT_PROJECT_NAME;

                // 2. if main.blocks is empty and main.ts is non-empty
                //    open typescript
                // https://github.com/microsoft/pxt/blob/master/webapp/src/app.tsx#L1032
                const mainBlocks = this.readFile(pxt.MAIN_BLOCKS);
                const mainTs = this.readFile(pxt.MAIN_TS);
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
                    inflateJRes(JSON.parse(this.readFile(f)), allres)
                }
            }
            return allres
        }

        isAssetPack() {
            return this.level > 0 && !!this.config?.assetPack;
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
            // patch github version numbers
            else if (this.verProtocol() == "github") {
                const ghid = pxt.github.parseRepoId(this._verspec);
                if (ghid && !ghid.tag && this.parent) {
                    // we have a valid repo but no tag
                    pxt.debug(`dep: unbound github extensions, trying to resolve tag`)
                    // check if we've already loaded this slug in the project, in which case we use that version number
                    const others = pxt.semver.sortLatestTags(Util.values(this.parent?.deps || {})
                        .map(dep => pxt.github.parseRepoId(dep.version()))
                        .filter(v => v?.slug === ghid.slug)
                        .map(v => v.tag));
                    const best = others[0];
                    if (best) {
                        ghid.tag = best;
                        this.resolvedVersion = v = pxt.github.stringifyRepo(ghid);
                        pxt.debug(`dep: github patched ${this._verspec} to ${v}`)
                    }
                }
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
                    if (!/^embed:/.test(verNo) && this.installedVersion == verNo)
                        return undefined;
                    pxt.debug('downloading ' + verNo)
                    return this.host().downloadPackageAsync(this)
                        .then(() => {
                            this.loadConfig();

                            if (this.isAssetPack()) {
                                this.writeAssetPackFiles();
                            }
                            pxt.debug(`installed ${this.id} /${verNo}`)
                        })

                })
        }

        loadConfig() {
            if (this.level != 0 && this.invalid())
                return; // don't try load invalid dependency

            const confStr = this.readFile(pxt.CONFIG_NAME)
            if (!confStr)
                U.userError(`extension ${this.id} is missing ${pxt.CONFIG_NAME}`)
            this.parseConfig(confStr);
            if (this.level != 0)
                this.installedVersion = this.version()
            this.saveConfig()
        }

        protected validateConfig() {
            if (!this.config.dependencies)
                U.userError("Missing dependencies in config of: " + this.id)
            if (!Array.isArray(this.config.files))
                U.userError("Missing files in config of: " + this.id)
            if (typeof this.config.name != "string" || !this.config.name)
                this.config.name = lf("Untitled");
            // don't be so uptight about project names,
            // handle invalid names downstream
            if (this.config.targetVersions
                && this.config.targetVersions.target
                && this.config.targetVersions.targetId === pxt.appTarget.id // make sure it's the same target
                && appTarget.versions
                && semver.majorCmp(this.config.targetVersions.target, appTarget.versions.target) > 0)
                U.userError(lf("{0} requires target version {1} (you are running {2})",
                    this.config.name, this.config.targetVersions.target, appTarget.versions.target))
        }

        isPackageInUse(pkgId: string, ts: string = this.readFile(pxt.MAIN_TS)): boolean {
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

        private upgradePackagesAsync(): Promise<pxt.Map<string>> {
            if (!this.config)
                this.loadConfig();
            return pxt.packagesConfigAsync()
                .then(packagesConfig => {
                    let numfixes = 0
                    let fixes: pxt.Map<string> = {};
                    U.iterMap(this.config.dependencies, (pkg, ver) => {
                        if (pxt.github.isGithubId(ver)) {
                            const upgraded = pxt.github.upgradedPackageReference(packagesConfig, ver)
                            if (upgraded && upgraded != ver) {
                                pxt.log(`upgrading dep ${pkg}: ${ver} -> ${upgraded}`);
                                fixes[ver] = upgraded;
                                this.config.dependencies[pkg] = upgraded
                                numfixes++
                            }
                        }
                    })
                    if (numfixes)
                        this.saveConfig()
                    return numfixes && fixes;
                })
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
                            if (!foundYottaConflict
                                && pkgCfg.name === depPkg.id
                                && depPkg._verspec !== version
                                && !/^file:/.test(depPkg._verspec)
                                && !/^file:/.test(version)) {
                                // we have a potential version mistmatch here
                                // check if versions are semver compatible for github refs
                                const ghCurrent = /^github:/.test(depPkg._verspec)
                                    && pxt.github.parseRepoId(depPkg._verspec);
                                const ghNew = /^github:/.test(version)
                                    && pxt.github.parseRepoId(version);
                                if (!ghCurrent || !ghNew // only for github refs
                                    || ghCurrent.fullName !== ghNew.fullName // must be same extension
                                    // if newversion does not have tag, it's ok
                                    // note: we are upgrade major versions as well
                                    || (ghNew.tag && pxt.semver.strcmp(ghCurrent.tag, ghNew.tag) < 0)) {
                                    const conflict = new cpp.PkgConflictError(lf("version mismatch for extension {0} (added: {1}, adding: {2})",
                                        depPkg.id,
                                        depPkg._verspec,
                                        version));
                                    conflict.pkg0 = depPkg;
                                    conflict.isVersionConflict = true;
                                    conflicts.push(conflict);
                                }
                            }
                        });
                    }
                    // Also check for conflicts for all the specified package's dependencies (recursively)
                    return Object.keys(pkgCfg?.dependencies ?? {}).reduce((soFar, pkgDep) => {
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
                                lf("a dependency of {0} has a version mismatch with extension {1} (added: {1}, adding: {2})", anc.id, pkgCfg.name, c.pkg0._verspec, version) :
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
                pxt.tickEvent("package.invalidConfigEncountered")
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
                /* eslint-disable @typescript-eslint/no-unused-expressions */
                if (allCorePkgs.length)
                    this.config.dependencies[allCorePkgs[0].name];
                /* eslint-enable @typescript-eslint/no-unused-expressions */
            } else if (corePackages.length > 1) {
                // keep last package
                corePackages.pop();
                corePackages.forEach(dep => {
                    pxt.log(`removing core package ${dep}`)
                    delete this.config.dependencies[dep];
                });
            }
        }

        resolvedDependencies(): Package[] {
            return Object.keys(this.dependencies()).map(n => this.resolveDep(n))
        }

        dependencies(includeCpp = false): pxt.Map<string> {
            if (!this.config) return {};

            const dependencies = Util.clone(this.config.dependencies || {});
            // add test dependencies if nedeed
            if (this.level == 0 && this.config.testDependencies) {
                // only add testDepdencies that can be resolved
                Util.iterMap(this.config.testDependencies, (k, v) => {
                    if (v != "*" || pxt.appTarget.bundledpkgs[k])
                        dependencies[k] = v;
                })
            }
            if (includeCpp && this.config.cppDependencies) {
                Util.jsonMergeFrom(dependencies, this.config.cppDependencies);
            }
            return dependencies;
        }

        async loadAsync(isInstall = false, targetVersion?: string): Promise<void> {
            if (this.isLoaded) return;


            if (this.level == 0 && !pxt.appTarget.multiVariants)
                pxt.setAppTargetVariant(null)

            this.isLoaded = true;
            const str = this.readFile(pxt.CONFIG_NAME);
            if (str == null) {
                if (!isInstall)
                    U.userError("Package not installed: " + this.id + ", did you forget to run `pxt install`?")
            } else {
                this.parseConfig(str);
            }

            // if we are installing this script, we haven't yet downloaded the config
            // do upgrade later
            if (this.level == 0 && !isInstall) {
                await this.upgradePackagesAsync();
            }

            if (isInstall) {
                await this.downloadAsync();
                if (this.level !== 0 && !this.isAssetPack()) {
                    for (const parent of this.addedBy) {
                        if (parent.config.assetPacks?.[this.id]) {
                            this.writeAssetPackFiles();
                            break;
                        }
                    }
                }
            }

            // we are installing the script, and we've download the original version and we haven't upgraded it yet
            // do upgrade and reload as needed
            if (this.level == 0 && isInstall) {
                const fixes = await this.upgradePackagesAsync();

                if (fixes) {
                    // worst case scenario with double load
                    Object.keys(fixes).forEach(key => pxt.tickEvent("package.doubleload", { "extension": key }))
                    pxt.log(`upgraded, downloading again`);
                    pxt.debug(fixes);
                    await this.downloadAsync();
                }
            }

            if (appTarget.simulator && appTarget.simulator.dynamicBoardDefinition) {
                if (this.level == 0) {
                    this.patchCorePackage();
                }
                if (this.config.compileServiceVariant) {
                    pxt.setAppTargetVariant(this.config.compileServiceVariant)
                }
                if (this.config.files.indexOf("board.json") >= 0) {
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
                }
            }

            const handleVerMismatch = (mod: Package, ver: string) => {
                pxt.debug(`version spec mismatch: ${mod._verspec} != ${ver}`)

                // if both are github, try to pick the higher semver
                if (/^github:/.test(mod._verspec) && /^github:/.test(ver)) {
                    const modid = pxt.github.parseRepoId(mod._verspec);
                    const verid = pxt.github.parseRepoId(ver);
                    // same repo
                    if (modid?.slug && modid?.slug === verid?.slug) {
                        // if modid does not have a tag, try sniffing it from config
                        // this may be an issue if the user does not create releases
                        // and pulls from master
                        const modtag = modid?.tag || mod.config?.version;
                        const vertag = verid.tag

                        // if there is no tag on the current dependency,
                        // assume same as existing module version if any
                        if (modtag && !vertag) {
                            pxt.debug(`unversioned ${ver}, using ${modtag}`)
                            return
                        }

                        const c = pxt.semver.strcmp(modtag, verid.tag);
                        if (c == 0) {
                            // turns out to be the same versions
                            pxt.debug(`resolved version are ${modtag}`)
                            return;
                        }
                        else if (c > 0) {
                            // already loaded version of dependencies (modtag) is greater
                            // than current version (ver), use it instead
                            pxt.debug(`auto-upgraded ${ver} to ${modtag}`)
                            return;
                        }
                    }
                }

                // ignore, file: protocol
                if (/^file:/.test(mod._verspec) || /^file:/.test(ver)) {
                    pxt.debug(`ignore file: mismatch issues`)
                    return;
                }

                // crashing if really really not good
                // so instead we just ignore and continute
                mod.configureAsInvalidPackage(lf("version mismatch"))
            }

            const loadDepsRecursive = async (deps: pxt.Map<string>, from: Package, isCpp = false) => {
                if (!deps) deps = from.dependencies(isCpp);

                pxt.debug(`deps: ${from.id}->${Object.keys(deps).join(", ")}`);
                deps = pxt.github.resolveMonoRepoVersions(deps);
                pxt.debug(`deps: resolved ${from.id}->${Object.keys(deps).join(", ")}`);

                for (let id of Object.keys(deps)) {
                    let ver = deps[id] || "*"
                    pxt.debug(`dep: load ${from.id}.${id}${isCpp ? "++" : ""}: ${ver}`)
                    if (id == "hw" && pxt.hwVariant)
                        id = "hw---" + pxt.hwVariant

                    // for github references, make sure the version is compatible with previously
                    // loaded references, regardless of the id
                    const ghver = github.parseRepoId(ver)
                    if (ghver?.slug) {
                        // let's start by resolving the maximum version
                        // number of the parent repo already loaded
                        const repoVersions = Object.values(from.parent.deps)
                            .map(p =>  github.parseRepoId(p._verspec))
                            .filter(v => v?.slug === ghver.slug)
                            .map(v => v.tag)
                        const repoVersion = repoVersions
                            .reduce((v1, v2) => semver.strcmp(v1, v2) > 0 ? v1 : v2, "0.0.0")
                        pxt.debug(`dep: common repo ${ghver.slug} version found ${repoVersion}`)
                        if (semver.strcmp(repoVersion, "0.0.0") > 0) {
                            // now let's check if we have a higher version to use
                            if (!ghver.tag || semver.strcmp(repoVersion, ghver.tag) > 0) {
                                pxt.debug(`dep: upgrade from ${ghver.tag} to ${repoVersion}`)
                                ghver.tag = repoVersion
                                ver = github.stringifyRepo(ghver, true)
                            }
                        }
                    }

                    let mod = from.resolveDep(id)
                    if (mod) {
                        // check if the current dependecy matches the ones
                        // loaded in parent
                        if (!mod.invalid() && mod._verspec !== ver)
                            handleVerMismatch(mod, ver);

                        // bail out if invalid
                        if (mod.invalid()) {
                            // failed to resolve dependency, ignore
                            mod.level = Math.min(mod.level, from.level + 1)
                            mod.addedBy.push(from)
                            continue
                        }

                        if (!isCpp) {
                            mod.level = Math.min(mod.level, from.level + 1)
                            mod.addedBy.push(from)
                        }
                    } else {
                        mod = new Package(id, ver, from.parent, from, id)
                        if (isCpp)
                            mod.cppOnly = true
                        from.parent.deps[id] = mod
                        // we can have "core---nrf52" to be used instead of "core" in other packages
                        from.parent.deps[id.replace(/---.*/, "")] = mod
                        await mod.loadAsync(isInstall)
                    }
                }
            }

            await loadDepsRecursive(null, this);

            // get paletter config loading deps, so the more higher level packages take precedence
            if (this.config.palette && appTarget.runtime) {
                appTarget.runtime.palette = U.clone(this.config.palette);
                if (this.config.paletteNames) appTarget.runtime.paletteNames = this.config.paletteNames;
            }
            // get screen size loading deps, so the more higher level packages take precedence
            if (this.config.screenSize && appTarget.runtime)
                appTarget.runtime.screenSize = U.clone(this.config.screenSize);

            if (this.level === 0) {
                // Check for missing packages. We need to add them 1 by 1 in case they conflict with eachother.
                const mainTs = this.readFile(pxt.MAIN_TS);
                if (mainTs) {
                    const missingPackages = this.getMissingPackages(this.config, mainTs);
                    let didAddPackages = false;
                    for (const missing of Object.keys(missingPackages)) {
                        const conflicts = await this.findConflictsAsync(missing, missingPackages[missing]);
                        if (conflicts.length) {
                            const conflictNames = conflicts.map((c) => c.pkg0.id).join(", ");
                            const settingNames = conflicts.map((c) => c.settingName).filter((s) => !!s).join(", ");
                            pxt.log(`skipping missing package ${missing} because it conflicts with the following packages: ${conflictNames} (conflicting settings: ${settingNames})`);
                        } else {
                            pxt.log(`adding missing package ${missing}`);
                            didAddPackages = true;
                            this.config.dependencies[missing] = "*"
                            const addDependency: Map<string> = {};
                            addDependency[missing] = missingPackages[missing];
                            await loadDepsRecursive(addDependency, this);
                        }
                    }

                    if (didAddPackages) {
                        this.saveConfig();
                        this.validateConfig();
                    }
                }

                await Promise.all(U.values(this.parent.deps).map(pkg => loadDepsRecursive(null, pkg, true)));
            }

            pxt.debug(`  installed ${this.id}`);
        }

        static depWarnings: Map<boolean> = {}
        getFiles() {
            let res: string[]
            if (this.level == 0 && !this.ignoreTests)
                res = this.config.files.concat(this.config.testFiles || [])
            else
                res = this.config.files.slice(0);
            const fd = this.config.fileDependencies
            if (this.config.fileDependencies)
                res = res.filter(fn => {
                    const evalCond = (cond: string): boolean => {
                        cond = cond.trim()
                        if (cond[0] == '!')
                            return !evalCond(cond.slice(1))
                        if (/^[\w-]+$/.test(cond)) {
                            const dep = this.parent.resolveDep(cond)
                            if (dep && !dep.cppOnly)
                                return true
                            return false
                        }
                        const m = /^target:(\w+)$/.exec(cond)
                        if (m)
                            return m[1] == pxt.appTarget.id || m[1] == pxt.appTarget.platformid

                        if (!Package.depWarnings[cond]) {
                            Package.depWarnings[cond] = true
                            pxt.log(`invalid dependency expression: ${cond} in ${this.id}/${fn}`)
                        }
                        return false
                    }

                    const cond = U.lookup(fd, fn)
                    if (!cond || !cond.trim()) return true
                    return cond.split('||').some(c => c.split('&&').every(evalCond))
                })
            return res
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
            const filenames = [this.config.name + "-jsdoc", this.config.name];
            const r: Map<string> = {};
            const theme = pxt.appTarget.appTheme || {};

            if (this.config.skipLocalization)
                return Promise.resolve(r);

            // live loc of bundled packages
            if (pxt.Util.liveLocalizationEnabled() && this.id != "this" && pxt.appTarget.bundledpkgs[this.id]) {
                pxt.debug(`loading live translations for ${this.id}`)
                return Promise.all(filenames.map(
                    fn => pxt.Util.downloadLiveTranslationsAsync(lang, `${targetId}/${fn}-strings.json`, theme.crowdinBranch)
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

            let [initialLang, baseLang, initialLangLowerCase] = pxt.Util.normalizeLanguageCode(lang);
            const files = this.config.files;

            let fn = `_locales/${initialLang}/${filename}-strings.json`;
            if (initialLangLowerCase && files.indexOf(fn) === -1) {
                fn = `_locales/${initialLangLowerCase}/${filename}-strings.json`;
            }
            if (baseLang && files.indexOf(fn) === -1) {
                fn = `_locales/${baseLang}/${filename}-strings.json`;
            }

            if (files.indexOf(fn) > -1) {
                try {
                    r = JSON.parse(this.readFile(fn));
                } catch (e) {
                    pxt.reportError("extension", "Extension localization JSON failed to parse", {
                        fileName: fn,
                        lang: lang,
                        extension: this.verArgument(),
                    });
                    const isGithubRepo = this.verProtocol() === "github";
                    if (isGithubRepo) {
                        pxt.tickEvent("loc.errors.json", {
                            repo: this.verArgument(),
                            file: fn,
                        });
                    }
                }
            }

            return r;
        }
    }

    export class MainPackage extends Package {
        public deps: Map<Package> = {};
        private _jres: Map<JRes>;

        constructor(public _host: Host) {
            super("this", "file:.", null, null, null)
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
            if (!res.utf8) {
                this.sortedDeps(true).forEach(p => {
                    if (p.config && p.config.utf8) {
                        pxt.debug("forcing utf8 mode: pkg=" + p.id)
                        res.utf8 = true
                    }
                })
            }
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

        updateJRes() {
            if (this._jres) {
                this.parseJRes(this._jres);
            }
        }

        // undefined == uncached
        // null == cached but no hit
        // array == means something go found...
        private _resolvedBannedCategories: string[];
        resolveBannedCategories(): string[] {
            if (this._resolvedBannedCategories !== undefined)
                return this._resolvedBannedCategories; // cache hit

            let bannedCategories: string[] = [];
            if (pxt.appTarget && pxt.appTarget.runtime
                && pxt.appTarget.runtime.bannedCategories
                && pxt.appTarget.runtime.bannedCategories.length) {
                bannedCategories = pxt.appTarget.runtime.bannedCategories.slice();
                // scan for unbanned categories
                Object.keys(this.deps)
                    .map(dep => this.deps[dep])
                    .filter(dep => !!dep)
                    .map(pk => pxt.Util.jsonTryParse(pk.readFile(pxt.CONFIG_NAME)) as pxt.PackageConfig)
                    .filter(config => config && config.requiredCategories)
                    .forEach(config => config.requiredCategories.forEach(rc => {
                        const i = bannedCategories.indexOf(rc);
                        if (i > -1)
                            bannedCategories.splice(i, 1);
                    }));
                this._resolvedBannedCategories = bannedCategories;
            }

            this._resolvedBannedCategories = bannedCategories;
            if (!this._resolvedBannedCategories.length)
                this._resolvedBannedCategories = null;
            return this._resolvedBannedCategories;
        }

        async getCompileOptionsAsync(target: pxtc.CompileTarget = this.getTargetOptions()): Promise<pxtc.CompileOptions> {
            let opts: pxtc.CompileOptions = {
                sourceFiles: [],
                fileSystem: {},
                target: target,
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

            let shimsGenerated = false

            const fillExtInfoAsync = async (variant: string) => {
                const res: pxtc.ExtensionTarget = {
                    extinfo: null,
                    target: null
                }
                const prevVariant = pxt.appTargetVariant

                if (variant)
                    pxt.setAppTargetVariant(variant, { temporary: true })

                try {
                    let einfo = cpp.getExtensionInfo(this)
                    if (!shimsGenerated && (einfo.shimsDTS || einfo.enumsDTS)) {
                        shimsGenerated = true
                        if (einfo.shimsDTS) generateFile("shims.d.ts", einfo.shimsDTS)
                        if (einfo.enumsDTS) generateFile("enums.d.ts", einfo.enumsDTS)
                    }

                    const inf = target.isNative ? await this.host().getHexInfoAsync(einfo) : null

                    einfo = U.flatClone(einfo)
                    if (!target.keepCppFiles) {
                        delete einfo.compileData;
                        delete einfo.generatedFiles;
                        delete einfo.extensionFiles;
                    }
                    einfo.hexinfo = inf

                    res.extinfo = einfo
                    res.target = pxt.appTarget.compile

                } finally {
                    if (variant)
                        pxt.setAppTargetVariant(prevVariant, { temporary: true })
                }

                return res
            }

            await this.loadAsync()

            opts.bannedCategories = this.resolveBannedCategories();
            pxt.debug(`building: ${this.sortedDeps().map(p => p.config.name).join(", ")}`)

            let variants: string[]

            if (pxt.appTarget.multiVariants) {
                // multiVariant available
                if (pxt.appTargetVariant) {
                    // set explicitly by the user
                    variants = [pxt.appTargetVariant]
                } else if (pxt.appTarget.alwaysMultiVariant || pxt.appTarget.compile.switches.multiVariant) {
                    // multivariants enabled
                    variants = pxt.appTarget.multiVariants
                } else {
                    // not enbaled - default to first variant
                    variants = [pxt.appTarget.multiVariants[0]]
                }
            } else {
                // no multi-variants, use empty variant name,
                // so we don't mess with pxt.setAppTargetVariant() in fillExtInfoAsync()
                variants = [null]
            }


            let ext: pxtc.ExtensionInfo = null
            for (let v of variants) {
                if (ext)
                    pxt.debug(`building for ${v}`)
                const etarget = await fillExtInfoAsync(v)
                const einfo = etarget.extinfo
                einfo.appVariant = v
                einfo.outputPrefix = variants.length == 1 || !v ? "" : v + "-"
                if (ext) {
                    opts.otherMultiVariants.push(etarget)
                } else {
                    etarget.target.isNative = opts.target.isNative;
                    opts.target = etarget.target;

                    ext = einfo
                    opts.otherMultiVariants = []
                }
            }
            opts.extinfo = ext

            opts.target.preferredEditor = this.getPreferredEditor();

            const noFileEmbed = appTarget.compile.shortPointers ||
                appTarget.compile.nativeType == "vm" ||
                this.config.binaryonly ||
                !opts.target.isNative

            if (!noFileEmbed) {
                const files = await this.filesToBePublishedAsync(true)
                const headerString = JSON.stringify({
                    name: this.config.name,
                    comment: this.config.description,
                    status: "unpublished",
                    scriptId: this.installedVersion,
                    cloudId: pxt.CLOUD_ID + appTarget.id,
                    editor: this.getPreferredEditor(),
                    targetVersions: pxt.appTarget.versions
                })
                const programText = JSON.stringify(files)
                const buf = await lzmaCompressAsync(headerString + programText)
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
            }

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
        }

        private prepareConfigToBePublished(): pxt.PackageConfig {
            const cfg = U.clone(this.config)
            delete (<any>cfg).installedVersion // cleanup old pxt.json files
            delete cfg.additionalFilePath
            delete cfg.additionalFilePaths
            if (!cfg.targetVersions) cfg.targetVersions = Util.clone(pxt.appTarget.versions);
            U.iterMap(cfg.dependencies, (k, v) => {
                if (!v || /^(file|workspace):/.test(v)) {
                    v = "*"
                    try {
                        const d = this.resolveDep(k)
                        const gitjson = d.readGitJson();
                        if (gitjson && gitjson.repo) {
                            let parsed = pxt.github.parseRepoId(gitjson.repo)
                            parsed.tag = gitjson.commit.tag || gitjson.commit.sha
                            v = pxt.github.stringifyRepo(parsed)
                        }
                    } catch (e) { }
                    cfg.dependencies[k] = v
                }
            })
            return cfg;
        }

        filesToBePublishedAsync(allowPrivate = false) {
            const files: Map<string> = {};
            return this.loadAsync()
                .then(() => {
                    if (!allowPrivate && !this.config.public)
                        U.userError('Only packages with "public":true can be published')
                    const cfg = this.prepareConfigToBePublished();
                    files[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(cfg);
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
                                    if (!/^data:image\/svg\+xml/.test(f)) // encode svg if not encoded yet
                                        f = `data:image/svg+xml,` + encodeURIComponent(f);
                                    part.visual.image = f;
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

    export function inflateJRes(js: Map<JRes>, allres: Map<JRes> = {}) {
        let base: JRes = js["*"] || {} as any
        for (let k of Object.keys(js)) {
            if (k == "*") continue
            let v = js[k]
            if (typeof v == "string") {
                // short form
                v = { data: v } as any
            }
            let ns = v.namespace || base.namespace || ""
            if (ns && !ns.endsWith(".")) ns += "."
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
                dataEncoding,
                icon,
                namespace: ns,
                mimeType,
                tilemapTile: v.tilemapTile,
                displayName: v.displayName,
                tileset: v.tileset,
                tags: v.tags
            }
        }

        return allres;
    }

    export function allPkgFiles(cfg: PackageConfig) {
        return [pxt.CONFIG_NAME].concat(cfg.files || []).concat(cfg.testFiles || [])
    }

    export function isPkgBeta(cfg: { description?: string; }): boolean {
        return cfg && /\bbeta\b/.test(cfg.description);
    }
}