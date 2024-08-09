import * as nodeutil from './nodeutil';
import * as fs from 'fs';
import * as path from 'path';

import Map = pxt.Map;

import * as commandParser from './commandparser';
import { downloadFileTranslationsAsync, getFileProgressAsync, listFilesAsync, restoreFileBefore, uploadFileAsync } from './crowdinApi';

export function uploadTargetTranslationsAsync(parsed?: commandParser.ParsedCommand) {
    const uploadDocs = parsed && !!parsed.flags["docs"];
    const uploadApiStrings = parsed && !!parsed.flags["apis"]
    if (parsed && !!parsed.flags["test"]) {
        pxt.crowdin.setTestMode();
    }
    return internalUploadTargetTranslationsAsync(uploadApiStrings, uploadDocs);
}

export async function internalUploadTargetTranslationsAsync(uploadApiStrings: boolean, uploadDocs: boolean) {
    pxt.log(`uploading translations (apis ${uploadApiStrings ? "yes" : "no"}, docs ${uploadDocs ? "yes" : "no"})...`);

    const crowdinDir = pxt.appTarget.id;
    if (crowdinDir == "core") {
        if (!uploadDocs) {
            pxt.log('missing --docs flag, skipping')
            return;
        }

        await uploadDocsTranslationsAsync("docs", crowdinDir);
        await uploadDocsTranslationsAsync("common-docs", crowdinDir);
    } else {
        if (uploadApiStrings) {
            await uploadBuiltStringsAsync("built/target-strings.json", crowdinDir);

            if (fs.existsSync("built/sim-strings.json")) {
                await uploadBuiltStringsAsync("built/sim-strings.json", crowdinDir);
            }
            await uploadBundledTranslationsAsync(crowdinDir);
        }
        else {
            pxt.log(`translations: skipping api strings upload`);
        }

        if (uploadDocs) {
            await uploadDocsTranslationsAsync("docs", crowdinDir);
            await Promise.all(
                pxt.appTarget.bundleddirs
                    .filter(pkgDir => nodeutil.existsDirSync(path.join(pkgDir, "docs")))
                    .map(pkgDir => uploadDocsTranslationsAsync(path.join(pkgDir, "docs"), crowdinDir))
            );
            pxt.log("docs uploaded");
        }
        else {
            pxt.log(`translations: skipping docs upload`);
        }
    }
}


export async function uploadBuiltStringsAsync(filename: string, crowdinDir?: string) {
    const baseName = path.basename(filename);
    const crowdinFile = crowdinDir ? path.join(crowdinDir, baseName) : baseName;
    const contents = fs.readFileSync(filename, "utf8");

    pxt.log(`Uploading ${filename} to ${crowdinFile}`);
    await uploadWithRetries(crowdinFile, contents);
}

async function uploadDocsTranslationsAsync(srcDir: string, crowdinDir: string): Promise<void> {
    pxt.log(`Uploading from ${srcDir} to ${crowdinDir}`)

    const ignoredDirectoriesList = getIgnoredDirectories(srcDir);
    const todo = nodeutil.allFiles(srcDir).filter(f => /\.md$/.test(f) && !/_locales/.test(f)).reverse();

    for (const file of todo) {
        if (!file) continue;

        const crowdinFile = path.join(crowdinDir, file);

        // check if file should be ignored
        if (ignoredDirectoriesList.filter(d => path.dirname(file).indexOf(d) == 0).length > 0) {
            pxt.log(`skipping ${file} because of .crowdinignore file`)
            continue;
        }

        const fileContent = fs.readFileSync(file, "utf8");
        if (!fileContent.trim()) {
            pxt.log(`skipping empty file ${file}`)
        }
        else {
            pxt.log(`Uploading ${file} to ${crowdinFile}`);
            await uploadWithRetries(crowdinFile, fileContent);
        }
    }
}

function getIgnoredDirectories(srcDir: string) {
    const ignoredDirectories: Map<boolean> = {};
    ignoredDirectories[srcDir] = nodeutil.fileExistsSync(path.join(srcDir, ".crowdinignore"));
    nodeutil.allFiles(srcDir)
        .forEach(d => {
            let p = path.dirname(d)
            // walk back up to srcDir or a path that has been checked
            while (ignoredDirectories[p] === undefined) {
                ignoredDirectories[p] = nodeutil.fileExistsSync(path.join(p, ".crowdinignore"));
                p = path.dirname(p);
            }
        });
    return Object.keys(ignoredDirectories).filter(d => ignoredDirectories[d]);
}

async function uploadBundledTranslationsAsync(crowdinDir: string) {
    const todo: string[] = [];
    for (const dir of pxt.appTarget.bundleddirs) {
        const locdir = path.join(dir, "_locales");
        if (fs.existsSync(locdir)) {
            const stringsFiles = fs.readdirSync(locdir).filter(f => /strings\.json$/i.test(f));

            for (const file of stringsFiles) {
                todo.unshift(path.join(locdir, file));
            }
        }
    }

    pxt.log(`uploading bundled translations to Crowdin (${todo.length} files)`);
    for (const file of todo) {
        const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Map<string>;
        const crowdinFile = path.join(crowdinDir, path.basename(file));
        pxt.log(`Uploading ${file} to ${crowdinFile}`);
        await uploadWithRetries(crowdinFile, JSON.stringify(data));
    }
}

export async function downloadTargetTranslationsAsync(parsed?: commandParser.ParsedCommand) {
    const name = parsed?.args[0];

    await buildAllTranslationsAsync(async (fileName: string) => {
        pxt.log(`downloading ${fileName}`);

        const translations = await downloadFileTranslationsAsync(fileName);
        const parsed: pxt.Map<pxt.Map<string>> = {};

        for (const file of Object.keys(translations)) {
            parsed[file] = JSON.parse(translations[file]);
        }

        return parsed;
    }, name);
}

export async function buildAllTranslationsAsync(fetchFileTranslationAsync: (fileName: string) => Promise<Map<Map<string>>>, singleDir?: string) {
    await buildTranslationFilesAsync(["sim-strings.json"], "sim-strings.json");
    await buildTranslationFilesAsync(["target-strings.json"], "target-strings.json");
    await buildTranslationFilesAsync(["strings.json"], "strings.json", true);
    await buildTranslationFilesAsync(["skillmap-strings.json"], "skillmap-strings.json", true);
    await buildTranslationFilesAsync(["webstrings.json"], "webstrings.json", true);

    const files: string[] = [];
    pxt.appTarget.bundleddirs
        .filter(dir => !singleDir || dir == "libs/" + singleDir)
        .forEach(dir => {
            const locdir = path.join(dir, "_locales");
            if (fs.existsSync(locdir))
                fs.readdirSync(locdir)
                    .filter(f => /\.json$/i.test(f))
                    .forEach(f => files.push(path.join(locdir, f)))
        });

    await buildTranslationFilesAsync(files, "bundled-strings.json");

    async function buildTranslationFilesAsync(files: string[], outputName: string, topLevel?: boolean) {
        const crowdinDir = pxt.appTarget.id;
        const locs: pxt.Map<pxt.Map<string>> = {};
        for (const filePath of files) {
            const fn = path.basename(filePath);
            const crowdf = topLevel ? fn : path.join(crowdinDir, fn);
            const locdir = path.dirname(filePath);
            const projectdir = path.dirname(locdir);
            pxt.debug(`projectdir: ${projectdir}`);
            const data = await fetchFileTranslationAsync(crowdf);

            for (const lang of Object.keys(data)) {
                const dataLang = data[lang];
                if (!dataLang || !stringifyTranslations(dataLang))
                    continue;

                // merge translations
                let strings = locs[lang];
                if (!strings) strings = locs[lang] = {};
                Object.keys(dataLang)
                    .filter(k => !!dataLang[k] && !strings[k])
                    .forEach(k => strings[k] = dataLang[k]);
            }
        }

        for (const lang of Object.keys(locs)) {
            const tf = path.join(`sim/public/locales/${lang}/${outputName}`);
            pxt.log(`writing ${tf}`);
            const dataLang = locs[lang];
            const langTranslations = stringifyTranslations(dataLang);
            nodeutil.writeFileSync(tf, langTranslations, { encoding: "utf8" });
        }
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

export async function execCrowdinAsync(cmd: string, ...args: string[]): Promise<void> {
    pxt.log(`executing Crowdin command ${cmd}...`);

    switch (cmd.toLowerCase()) {
        case "stats":
            execStatsAsync(args[0]);
            break;
        case "clean":
            await execCleanAsync(args[0] || "docs");
            break;
        case "upload":
            if (!args[0]) {
                throw new Error("filename missing");
            }
            await uploadBuiltStringsAsync(args[0], args[1]);
            break;
        case "download":
            if (!args[1]) {
                throw new Error("output path missing");
            }
            await execDownloadAsync(args[0], args[1]);
            break;
        case "restore":
            if (!args[0]) {
                throw new Error("Time missing");
            }
            if (args[1] !== "force" && !pxt.crowdin.testMode) {
                throw new Error(`Refusing to run restore command without 'force' argument. Re-run as 'pxt crowdin restore <date> force' to proceed or use --test flag to test.`);
            }
            execRestoreFiles(args[0]);
            break;
        default:
            throw new Error("unknown command");
    }
}

async function execDownloadAsync(filename: string, outputDir: string): Promise<void> {
    const basename = path.basename(filename);
    pxt.log("Downloading translations")
    const translations = await downloadFileTranslationsAsync(filename);

    for (const language of Object.keys(translations)) {
        const langTranslations = stringifyTranslations(JSON.parse(translations[language]));
        if (!langTranslations) continue;

        nodeutil.mkdirP(path.join(outputDir, language));
        const outFilename = path.join(outputDir, language, basename);
        console.log(`Writing ${outFilename}`);
        nodeutil.writeFileSync(outFilename, langTranslations, { encoding: "utf8" });
    }
}

async function execCleanAsync(dir: string): Promise<void> {
    const directoryPath = pxt.appTarget.id + "/" + dir;

    const files = await listFilesAsync(directoryPath);

    for (const file of files) {
        if (!nodeutil.fileExistsSync(file.substring(pxt.appTarget.id.length + 1))) {
            pxt.log(`crowdin: dead file: ${file}`)
        }
    }
}

interface LanguageStats {
    uiphrases: number;
    uitranslated: number;
    uiapproved: number;
    corephrases: number;
    coretranslated: number;
    coreapproved: number;
    phrases: number;
    translated: number;
    approved: number;
}

async function execStatsAsync(language?: string) {
    const crowdinDir = pxt.appTarget.id;

    // If this is run inside pxt-core, give results for all targets
    const isCore = crowdinDir === "core";
    pxt.log(`collecting crowdin stats for ${isCore ? "all targets" : crowdinDir} ${language ? `for language ${language}` : `all languages`}`);

    const files = await listFilesAsync();
    const stats: pxt.Map<LanguageStats> = {};

    const outputCsvFile = `crowdinstats.csv`;
    let headers = 'sep=\t\r\n';
    headers += `file\t language\t phrases\t translated\t approved\r\n`;
    nodeutil.writeFileSync(outputCsvFile, headers, { encoding: "utf8" });

    for (const file of files) {
        pxt.debug("Processing file: " + file + "...");

        // We only care about strings files
        if (!file.endsWith("-strings.json")) continue;

        // Files for core are in the top-level of the crowdin project
        const isCoreFile = file.indexOf("/") === -1;

        // Only include files for the current target and core
        if (!isCore && !isCoreFile && !file.startsWith(crowdinDir + "/")) continue;

        pxt.debug(`Downloading progress`)
        const progress = await getFileProgressAsync(file, language && [language]);

        let fileCsvRows = "";
        for (const language of progress) {
            if (!stats[language.languageId]) {
                stats[language.languageId] = {
                    uiphrases: 0,
                    uitranslated: 0,
                    uiapproved: 0,
                    corephrases: 0,
                    coretranslated: 0,
                    coreapproved: 0,
                    phrases: 0,
                    translated: 0,
                    approved: 0
                };
            }

            const fileCsvColumns = [
                file,
                language.languageId,
                language.phrases.total,
                language.phrases.translated,
                language.phrases.approved
            ];

            fileCsvRows += `${fileCsvColumns.join("\t ")}\r\n`;

            const langStats = stats[language.languageId];

            if (file === "strings.json") {
                langStats.uiapproved += language.phrases.approved
                langStats.uitranslated += language.phrases.translated;
                langStats.uiphrases += language.phrases.total;
            }
            else if (/core-strings\.json$/.test(file)) {
                langStats.coreapproved += language.phrases.approved
                langStats.coretranslated += language.phrases.translated;
                langStats.corephrases += language.phrases.total;
            }
            else {
                langStats.approved += language.phrases.approved
                langStats.translated += language.phrases.translated;
                langStats.phrases += language.phrases.total;
            }
        }

        fs.appendFileSync(outputCsvFile, fileCsvRows, { encoding: "utf8" });
    }

    console.log(`context\t language\t translated%\t approved%\t phrases\t translated\t approved`)
    for (const language of Object.keys(stats)) {
        const {
            uiphrases,
            uitranslated,
            uiapproved,
            corephrases,
            coretranslated,
            coreapproved,
            phrases,
            translated,
            approved,
        } = stats[language];

        console.log(`ui\t ${language}\t ${(uitranslated / uiphrases * 100) >> 0}%\t ${(uiapproved / uiphrases * 100) >> 0}%\t ${uiphrases}\t ${uitranslated}\t ${uiapproved}`)
        console.log(`core\t ${language}\t ${(coretranslated / corephrases * 100) >> 0}%\t ${(coreapproved / corephrases * 100) >> 0}%\t ${corephrases}\t ${coretranslated}\t ${coreapproved}`)
        console.log(`blocks\t ${language}\t ${(translated / phrases * 100) >> 0}%\t ${(approved / phrases * 100) >> 0}%\t ${phrases}\t ${translated}\t ${approved}`)
    }
}

async function execRestoreFiles(time: string | number) {
    let cutoffTime;

    if (!isNaN(parseInt(time + ""))) {
        cutoffTime = parseInt(time + "");
    }
    else {
        cutoffTime = new Date(time).getTime();
    }

    const crowdinDir = pxt.appTarget.id;

    // If this is run inside pxt-core, give results for all targets
    const isCore = crowdinDir === "core";

    const files = await listFilesAsync();

    for (const file of files) {
        pxt.debug("Processing file: " + file + "...");

        // Files for core are in the top-level of the crowdin project
        const isCoreFile = file.indexOf("/") === -1;


        if ((isCore && !isCoreFile) || !file.startsWith(crowdinDir + "/")) continue;

        await restoreFileBefore(file, cutoffTime);
    }
}

async function uploadWithRetries(filename: string, fileContent: string, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
        try {
            await uploadFileAsync(filename, fileContent);
            return;
        }
        catch (e) {
            if (i < attempts - 1) {
                console.warn(e);
                pxt.log(`Upload failed, retrying in 3 seconds`);
                await pxt.U.delay(3000);
            }
            else {
                pxt.log(`Maximum upload retries exceeded for file ${filename}`);
                throw e;
            }
        }
    }
}
