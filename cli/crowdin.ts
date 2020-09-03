import * as nodeutil from './nodeutil';
import * as fs from 'fs';
import * as path from 'path';

import Map = pxt.Map;

import * as commandParser from './commandparser';

interface CrowdinCredentials { prj: string; key: string; branch: string; }

function crowdinCredentialsAsync(): Promise<CrowdinCredentials> {
    const prj = pxt.appTarget.appTheme.crowdinProject;
    const branch = pxt.appTarget.appTheme.crowdinBranch;
    if (!prj) {
        pxt.log(`crowdin upload skipped, Crowdin project missing in target theme`);
        return Promise.resolve(undefined);
    }

    let key: string;
    if (pxt.crowdin.testMode)
        key = pxt.crowdin.TEST_KEY;
    else
        key = process.env[pxt.crowdin.KEY_VARIABLE];
    if (!key) {
        pxt.log(`Crowdin operation skipped: '${pxt.crowdin.KEY_VARIABLE}' variable is missing`);
        return Promise.resolve(undefined);
    }
    return Promise.resolve({ prj, key, branch });
}

export function uploadTargetTranslationsAsync(parsed?: commandParser.ParsedCommand) {
    const uploadDocs = parsed && !!parsed.flags["docs"];
    const uploadApiStrings = parsed && !!parsed.flags["apis"]
    if (parsed && !!parsed.flags["test"])
        pxt.crowdin.setTestMode();
    return internalUploadTargetTranslationsAsync(uploadApiStrings, uploadDocs);
}

export function internalUploadTargetTranslationsAsync(uploadApiStrings: boolean, uploadDocs: boolean) {
    pxt.log(`uploading translations (apis ${uploadApiStrings ? "yes" : "no"}, docs ${uploadDocs ? "yes" : "no"})...`);
    return crowdinCredentialsAsync()
        .then(cred => {
            if (!cred) return Promise.resolve();
            pxt.log("got Crowdin credentials");
            const crowdinDir = pxt.appTarget.id;
            if (crowdinDir == "core") {
                if (!uploadDocs) {
                    pxt.log('missing --docs flag, skipping')
                    return Promise.resolve();
                }
                return uploadDocsTranslationsAsync("docs", crowdinDir, cred.branch, cred.prj, cred.key)
                    .then(() => uploadDocsTranslationsAsync("common-docs", crowdinDir, cred.branch, cred.prj, cred.key))
            } else {
                let p = Promise.resolve();
                if (uploadApiStrings)
                    p = p.then(() => execCrowdinAsync("upload", "built/target-strings.json", crowdinDir))
                        .then(() => fs.existsSync("built/sim-strings.json") ? execCrowdinAsync("upload", "built/sim-strings.json", crowdinDir) : Promise.resolve())
                        .then(() => uploadBundledTranslationsAsync(crowdinDir, cred.branch, cred.prj, cred.key));
                else
                    p = p.then(() => pxt.log(`translations: skipping api strings upload`));
                if (uploadDocs)
                    p = p.then(() => uploadDocsTranslationsAsync("docs", crowdinDir, cred.branch, cred.prj, cred.key))
                        // scan for docs in bundled packages
                        .then(() => Promise.all(pxt.appTarget.bundleddirs
                            // there must be a folder under .../docs
                            .filter(pkgDir => nodeutil.existsDirSync(path.join(pkgDir, "docs")))
                            // upload to crowdin
                            .map(pkgDir => uploadDocsTranslationsAsync(path.join(pkgDir, "docs"), crowdinDir, cred.branch, cred.prj, cred.key)
                            )).then(() => {
                                pxt.log("docs uploaded");
                            }));
                else
                    p = p.then(() => pxt.log(`translations: skipping docs upload`));
                return p;
            }
        });
}

function uploadDocsTranslationsAsync(srcDir: string, crowdinDir: string, branch: string, prj: string, key: string): Promise<void> {
    pxt.log(`uploading from ${srcDir} to ${crowdinDir} under project ${prj}/${branch || ""}`)

    let ignoredDirectories: Map<boolean> = {};
    nodeutil.allFiles(srcDir).filter(d => nodeutil.fileExistsSync(path.join(path.dirname(d), ".crowdinignore"))).forEach(f => ignoredDirectories[path.dirname(f)] = true);
    const ignoredDirectoriesList = Object.keys(ignoredDirectories);
    const todo = nodeutil.allFiles(srcDir).filter(f => /\.md$/.test(f) && !/_locales/.test(f)).reverse();
    const knownFolders: Map<boolean> = {};
    const ensureFolderAsync = (crowdd: string) => {
        if (!knownFolders[crowdd]) {
            knownFolders[crowdd] = true;
            pxt.log(`creating folder ${crowdd}`);
            return pxt.crowdin.createDirectoryAsync(branch, prj, key, crowdd);
        }
        return Promise.resolve();
    }
    const nextFileAsync = (f: string): Promise<void> => {
        if (!f) return Promise.resolve();
        const crowdf = path.join(crowdinDir, f);
        const crowdd = path.dirname(crowdf);
        // check if file should be ignored
        if (ignoredDirectoriesList.filter(d => path.dirname(f).indexOf(d) == 0).length > 0) {
            pxt.log(`skpping ${f} because of .crowdinignore file`)
            return nextFileAsync(todo.pop());
        }

        const data = fs.readFileSync(f, 'utf8');
        pxt.log(`uploading ${f} to ${crowdf}`);
        return ensureFolderAsync(crowdd)
            .then(() => pxt.crowdin.uploadTranslationAsync(branch, prj, key, crowdf, data))
            .then(() => nextFileAsync(todo.pop()));
    }
    return ensureFolderAsync(path.join(crowdinDir, srcDir))
        .then(() => nextFileAsync(todo.pop()));
}

function uploadBundledTranslationsAsync(crowdinDir: string, branch: string, prj: string, key: string): Promise<void> {
    const todo: string[] = [];
    pxt.appTarget.bundleddirs.forEach(dir => {
        const locdir = path.join(dir, "_locales");
        if (fs.existsSync(locdir))
            fs.readdirSync(locdir)
                .filter(f => /strings\.json$/i.test(f))
                .forEach(f => todo.push(path.join(locdir, f)))
    });

    pxt.log(`uploading bundled translations to Crowdin (${todo.length} files)`);
    const nextFileAsync = (): Promise<void> => {
        const f = todo.pop();
        if (!f) return Promise.resolve();
        const data = JSON.parse(fs.readFileSync(f, 'utf8')) as Map<string>;
        const crowdf = path.join(crowdinDir, path.basename(f));
        pxt.log(`uploading ${f} to ${crowdf}`);
        return pxt.crowdin.uploadTranslationAsync(branch, prj, key, crowdf, JSON.stringify(data))
            .then(nextFileAsync);
    }
    return nextFileAsync();
}

export function downloadTargetTranslationsAsync(parsed?: commandParser.ParsedCommand) {
    const name = (parsed && parsed.args[0]) || "";
    const crowdinDir = pxt.appTarget.id;
    return crowdinCredentialsAsync()
        .then(cred => {
            if (!cred) return Promise.resolve();

            return downloadFilesAsync(cred, ["sim-strings.json"], "sim")
                .then(() => downloadFilesAsync(cred, ["target-strings.json"], "target"))
                .then(() => {
                    const files: string[] = [];
                    pxt.appTarget.bundleddirs
                        .filter(dir => !name || dir == "libs/" + name)
                        .forEach(dir => {
                            const locdir = path.join(dir, "_locales");
                            if (fs.existsSync(locdir))
                                fs.readdirSync(locdir)
                                    .filter(f => /\.json$/i.test(f))
                                    .forEach(f => files.push(path.join(locdir, f)))
                        });
                    return downloadFilesAsync(cred, files, "bundled");
                });
        });

    function downloadFilesAsync(cred: CrowdinCredentials, todo: string[], outputName: string) {
        const locs: pxt.Map<pxt.Map<string>> = {};
        const nextFileAsync = (): Promise<void> => {
            const f = todo.pop();
            if (!f) {
                return Promise.resolve();
            }

            const errors: pxt.Map<number> = {};
            const fn = path.basename(f);
            const crowdf = path.join(crowdinDir, fn);
            const locdir = path.dirname(f);
            const projectdir = path.dirname(locdir);
            pxt.log(`downloading ${crowdf}`);
            pxt.debug(`projectdir: ${projectdir}`)
            return pxt.crowdin.downloadTranslationsAsync(cred.branch, cred.prj, cred.key, crowdf, { translatedOnly: true, validatedOnly: true })
                .then(data => {
                    Object.keys(data)
                        .filter(lang => Object.keys(data[lang]).some(k => !!data[lang][k]))
                        .forEach(lang => {
                            const dataLang = data[lang];
                            const langTranslations = stringifyTranslations(dataLang);
                            if (!langTranslations) return;

                            // validate translations
                            if (/-strings\.json$/.test(fn) && !/jsdoc-strings\.json$/.test(fn)) {
                                // block definitions
                                Object.keys(dataLang).forEach(id => {
                                    const tr = dataLang[id];
                                    pxt.blocks.normalizeBlock(tr, err => {
                                        const errid = `${fn}.${lang}`;
                                        errors[`${fn}.${lang}`] = 1
                                        pxt.log(`error ${errid}: ${err}`)
                                    });
                                });
                            }

                            // merge translations
                            let strings = locs[lang];
                            if (!strings) strings = locs[lang] = {};
                            Object.keys(dataLang)
                                .filter(k => !!dataLang[k] && !strings[k])
                                .forEach(k => strings[k] = dataLang[k]);
                        })

                    const errorIds = Object.keys(errors);
                    if (errorIds.length) {
                        pxt.log(`${errorIds.length} errors`);
                        errorIds.forEach(blockid => pxt.log(`error in ${blockid}`));
                        pxt.reportError("loc.errors", "invalid translation", errors);
                    }

                    return nextFileAsync()
                });
        }
        return nextFileAsync()
            .then(() => {
                Object.keys(locs).forEach(lang => {
                    const tf = path.join(`sim/public/locales/${lang}/${outputName}-strings.json`);
                    pxt.log(`writing ${tf}`);
                    const dataLang = locs[lang];
                    const langTranslations = stringifyTranslations(dataLang);
                    nodeutil.writeFileSync(tf, langTranslations, { encoding: "utf8" });
                })
            })
    }
}

function stringifyTranslations(strings: pxt.Map<string>): string {
    const trg: pxt.Map<string> = {};
    Object.keys(strings).sort().forEach(k => {
        const v = strings[k].trim();
        if (v) trg[k] = v;
    })
    if (Object.keys(trg).length == 0) return undefined;
    else return JSON.stringify(trg, null, 2);
}

export function execCrowdinAsync(cmd: string, ...args: string[]): Promise<void> {
    pxt.log(`executing Crowdin command ${cmd}...`);
    const prj = pxt.appTarget.appTheme.crowdinProject;
    if (!prj) {
        console.log(`crowdin operation skipped, crowdin project not specified in pxtarget.json`);
        return Promise.resolve();
    }
    const branch = pxt.appTarget.appTheme.crowdinBranch;
    return crowdinCredentialsAsync()
        .then(crowdinCredentials => {
            if (!crowdinCredentials) return Promise.resolve();
            const key = crowdinCredentials.key;
            cmd = cmd.toLowerCase();
            if (!args[0] && (cmd != "clean" && cmd != "stats")) throw new Error(cmd == "status" ? "language missing" : "filename missing");
            switch (cmd) {
                case "stats": return statsCrowdinAsync(prj, key, args[0]);
                case "clean": return cleanCrowdinAsync(prj, key, args[0] || "docs");
                case "upload": return uploadCrowdinAsync(branch, prj, key, args[0], args[1]);
                case "download": {
                    if (!args[1]) throw new Error("output path missing");
                    const fn = path.basename(args[0]);
                    return pxt.crowdin.downloadTranslationsAsync(branch, prj, key, args[0], { translatedOnly: true, validatedOnly: true })
                        .then(r => {
                            Object.keys(r).forEach(k => {
                                const rtranslations = stringifyTranslations(r[k]);
                                if (!rtranslations) return;

                                nodeutil.mkdirP(path.join(args[1], k));
                                const outf = path.join(args[1], k, fn);
                                console.log(`writing ${outf}`)
                                nodeutil.writeFileSync(
                                    outf,
                                    rtranslations,
                                    { encoding: "utf8" });
                            })
                        })
                }
                default: throw new Error("unknown command");
            }
        })
}

function cleanCrowdinAsync(prj: string, key: string, dir: string): Promise<void> {
    const p = pxt.appTarget.id + "/" + dir;
    return pxt.crowdin.listFilesAsync(prj, key, p)
        .then(files => {
            files.filter(f => !nodeutil.fileExistsSync(f.fullName.substring(pxt.appTarget.id.length + 1)))
                .forEach(f => pxt.log(`crowdin: dead file: ${f.branch ? f.branch + "/" : ""}${f.fullName}`));
        })
}

function statsCrowdinAsync(prj: string, key: string, preferredLang?: string): Promise<void> {
    pxt.log(`collecting crowdin stats for ${prj} ${preferredLang ? `for language ${preferredLang}` : `all languages`}`);
    console.log(`context\t language\t translated%\t approved%\t phrases\t translated\t approved`)

    const fn = `crowdinstats.csv`;
    let headers = 'sep=\t\r\n';
    headers += `id\t file\t language\t phrases\t translated\t approved\r\n`;
    nodeutil.writeFileSync(fn, headers, { encoding: "utf8" });
    return pxt.crowdin.projectInfoAsync(prj, key)
        .then(info => {
            if (!info) throw new Error("info failed")
            let languages = info.languages;
            // remove in-context language
            languages = languages.filter(l => l.code != ts.pxtc.Util.TRANSLATION_LOCALE);
            if (preferredLang)
                languages = languages.filter(lang => lang.code.toLowerCase() == preferredLang.toLowerCase());
            return Promise.all(languages.map(lang => langStatsCrowdinAsync(prj, key, lang.code)))
        }).then(() => {
            console.log(`stats written to ${fn}`)
        })

    function langStatsCrowdinAsync(prj: string, key: string, lang: string): Promise<void> {
        return pxt.crowdin.languageStatsAsync(prj, key, lang)
            .then(stats => {
                let uiphrases = 0;
                let uitranslated = 0;
                let uiapproved = 0;
                let corephrases = 0;
                let coretranslated = 0;
                let coreapproved = 0;
                let phrases = 0;
                let translated = 0;
                let approved = 0;
                let r = '';
                stats.forEach(stat => {
                    const cfn = `${stat.branch ? stat.branch + "/" : ""}${stat.fullName}`;
                    r += `${stat.id}\t ${cfn}\t ${lang}\t ${stat.phrases}\t ${stat.translated}\t ${stat.approved}\r\n`;
                    if (stat.fullName == "strings.json") {
                        uiapproved += Number(stat.approved);
                        uitranslated += Number(stat.translated);
                        uiphrases += Number(stat.phrases);
                    } else if (/core-strings\.json$/.test(stat.fullName)) {
                        coreapproved += Number(stat.approved);
                        coretranslated += Number(stat.translated);
                        corephrases += Number(stat.phrases);
                    } else if (/-strings\.json$/.test(stat.fullName)) {
                        approved += Number(stat.approved);
                        translated += Number(stat.translated);
                        phrases += Number(stat.phrases);
                    }
                })
                fs.appendFileSync(fn, r, { encoding: "utf8" });
                console.log(`ui\t ${lang}\t ${(uitranslated / uiphrases * 100) >> 0}%\t ${(uiapproved / uiphrases * 100) >> 0}%\t ${uiphrases}\t ${uitranslated}\t ${uiapproved}`)
                console.log(`core\t ${lang}\t ${(coretranslated / corephrases * 100) >> 0}%\t ${(coreapproved / corephrases * 100) >> 0}%\t ${corephrases}\t ${coretranslated}\t ${coreapproved}`)
                console.log(`blocks\t ${lang}\t ${(translated / phrases * 100) >> 0}%\t ${(approved / phrases * 100) >> 0}%\t ${phrases}\t ${translated}\t ${approved}`)
            })
    }

}

function uploadCrowdinAsync(branch: string, prj: string, key: string, p: string, dir?: string): Promise<void> {
    let fn = path.basename(p);
    if (dir) fn = dir.replace(/[\\/]*$/g, '') + '/' + fn;
    const data = JSON.parse(fs.readFileSync(p, "utf8")) as Map<string>;
    pxt.log(`upload ${fn} (${Object.keys(data).length} strings) to https://crowdin.com/project/${prj}${branch ? `?branch=${branch}` : ''}`);
    return pxt.crowdin.uploadTranslationAsync(branch, prj, key, fn, JSON.stringify(data));
}
