import crowdin, { Credentials, SourceFilesModel } from '@crowdin/crowdin-api-client';
import * as path from 'path';
import axios from 'axios';

import * as AdmZip from "adm-zip";

let client: crowdin;
const KINDSCRIPT_PROJECT_ID = 157956;

let projectId = KINDSCRIPT_PROJECT_ID;

let fetchedFiles: SourceFilesModel.File[];
let fetchedDirectories: SourceFilesModel.Directory[];

export function setProjectId(id: number) {
    projectId = id;
    fetchedFiles = undefined;
    fetchedDirectories = undefined;
}

export async function uploadFileAsync(fileName: string, fileContent: string): Promise<void> {
    const files = await getAllFiles();

    // If file already exists, update it
    for (const file of files) {
        if (normalizePath(file.path) === normalizePath(fileName)) {
            await updateFile(file.id, path.basename(fileName), fileContent);
            return;
        }
    }

    // Ensure directory exists
    const parentDir = path.dirname(fileName);
    let parentDirId: number;
    if (parentDir && parentDir !== ".") {
        parentDirId = (await mkdirAsync(parentDir)).id;
    }

    // Create new file
    await createFile(path.basename(fileName), fileContent, parentDirId);
}

export async function getProjectInfoAsync() {
    const { projectsGroupsApi } = getClient();

    const project = await projectsGroupsApi.getProject(projectId);
    return project.data;
}

export async function getProjectProgressAsync(languages?: string[]) {
    const { translationStatusApi } = getClient();

    const stats = await translationStatusApi
        .withFetchAll()
        .getProjectProgress(projectId);

    let results = stats.data.map(stat => stat.data);
    if (languages) {
        results = results.filter(stat => languages.indexOf(stat.language.locale) !== -1 || languages.indexOf(stat.language.twoLettersCode) !== -1);
    }

    return results;
}

export async function getDirectoryProgressAsync(directory: string, languages?: string[]) {
    const { translationStatusApi } = getClient();

    const directoryId = await getDirectoryIdAsync(directory);

    const stats = await translationStatusApi
        .withFetchAll()
        .getDirectoryProgress(projectId, directoryId);

    let results = stats.data.map(stat => stat.data);
    if (languages) {
        results = results.filter(stat => languages.indexOf(stat.language.locale) !== -1 || languages.indexOf(stat.language.twoLettersCode) !== -1);
    }

    return results;
}

export async function getFileProgressAsync(file: string, languages?: string[]) {
    const { translationStatusApi } = getClient();

    const fileId = await getFileIdAsync(file);

    const stats = await translationStatusApi
        .withFetchAll()
        .getFileProgress(projectId, fileId);

    let results = stats.data.map(stat => stat.data);
    if (languages) {
        results = results.filter(stat => languages.indexOf(stat.language.locale) !== -1 || languages.indexOf(stat.language.twoLettersCode) !== -1);
    }

    return results;
}

export async function listFilesAsync(directory: string): Promise<string[]> {
    directory = normalizePath(directory);
    const files = (await getAllFiles()).map(file => normalizePath(file.path));

    return files.filter(file => file.startsWith(directory));
}

export async function downloadTranslationsAsync(directory?: string) {
    const { translationsApi } = getClient();

    let buildId: number;
    let status: string;

    const options = {
        skipUntranslatedFiles: true,
        exportApprovedOnly: true
    };

    if (directory) {
        pxt.log(`Building translations for directory ${directory}`);
        const directoryId = await getDirectoryIdAsync(directory);
        const buildResp = await translationsApi.buildProjectDirectoryTranslation(projectId, directoryId, options);
        buildId = buildResp.data.id;
        status = buildResp.data.status;
    }
    else {
        pxt.log(`Building all translations`)
        const buildResp = await translationsApi.buildProject(projectId, options);
        buildId = buildResp.data.id;
        status = buildResp.data.status;
    }

    // Translation builds take a long time, so poll for progress
    while (status !== "finished") {
        const progress = await translationsApi.checkBuildStatus(projectId, buildId);
        status = progress.data.status;

        pxt.log(`Translation build progress: ${progress.data.progress}%`)
        if (status !== "finished") {
            await pxt.Util.delay(5000);
        }
    }

    pxt.log("Fetching translation build");
    const downloadReq = await translationsApi.downloadTranslations(projectId, buildId);

    // The downloaded file is a zip of all files broken out in a directory for each language
    // e.g. /en/docs/tutorial.md, /fr/docs/tutorial.md, etc.
    pxt.log("Downloading translation zip");
    const zipFile = await axios.get(downloadReq.data.url, { responseType: 'arraybuffer' });

    const zip = new AdmZip(Buffer.from(zipFile.data));

    const entries = zip.getEntries();
    const filesystem: pxt.Map<string> = {};

    for (const entry of entries) {
        if (entry.isDirectory) continue;

        filesystem[entry.entryName] = zip.readAsText(entry);
    }

    pxt.log("Translation download complete");

    return filesystem;
}

export async function downloadFileTranslationsAsync(fileName: string): Promise<pxt.Map<string>> {
    const { translationsApi } = getClient();
    const fileId = await getFileIdAsync(fileName);
    const projectInfo = await getProjectInfoAsync();

    let todo = projectInfo.targetLanguageIds.filter(id => id !== "en");

    if (pxt.appTarget && pxt.appTarget.appTheme && pxt.appTarget.appTheme.availableLocales) {
        todo = todo.filter(l => pxt.appTarget.appTheme.availableLocales.indexOf(l) > -1);
    }

    const options = {
        skipUntranslatedFiles: true,
        exportApprovedOnly: true
    };

    const results: pxt.Map<string> = {};

    // There's no API to get all translations for a file, so we have to build each one individually
    for (const language of todo) {
        pxt.debug(`Building ${language} translation for '${fileName}'`);

        try {
            const buildResp = await translationsApi.buildProjectFileTranslation(projectId, fileId, {
                targetLanguageId: language,
                ...options
            });

            if (!buildResp.data) {
                pxt.debug(`No translation available for ${language}`);
                continue;
            }

            const textResp = await axios.get(buildResp.data.url, { responseType: "text" });
            results[language] = textResp.data;
        }
        catch (e) {
            console.log(`Error building ${language} translation for '${fileName}'`, e);
            continue;
        }
    }

    return results;
}

async function getFileIdAsync(fileName: string): Promise<number> {
    for (const file of await getAllFiles()) {
        if (normalizePath(file.path) === normalizePath(fileName)) {
            return file.id;
        }
    }

    throw new Error(`File '${fileName}' not found in crowdin project`);
}

async function getDirectoryIdAsync(dirName: string): Promise<number> {
    for (const dir of await getAllDirectories()) {
        if (normalizePath(dir.path) === normalizePath(dirName)) {
            return dir.id;
        }
    }

    throw new Error(`Directory '${dirName}' not found in crowdin project`);
}

async function mkdirAsync(dirName: string): Promise<SourceFilesModel.Directory> {
    const dirs = await getAllDirectories();

    for (const dir of dirs) {
        if (normalizePath(dir.path) === normalizePath(dirName)) {
            return dir;
        }
    }

    let parentDirId: number;
    const parentDir = path.dirname(dirName);
    if (parentDir && parentDir !== ".") {
        parentDirId = (await mkdirAsync(parentDir)).id;
    }

    return await createDirectory(path.basename(dirName), parentDirId);
}

async function getAllDirectories() {
    // This request takes a decent amount of time, so cache the results
    if (!fetchedDirectories) {
        const { sourceFilesApi } = getClient();

        pxt.debug(`Fetching directories`)
        const dirsResponse = await sourceFilesApi
            .withFetchAll()
            .listProjectDirectories(projectId, {});

        let dirs = dirsResponse.data.map(fileResponse => fileResponse.data);

        if (!dirs.length) {
            throw new Error("No directories found!");
        }

        pxt.debug(`Directory count: ${dirs.length}`);

        fetchedDirectories = dirs;
    }

    return fetchedDirectories;
}

async function getAllFiles() {
    // This request takes a decent amount of time, so cache the results
    if (!fetchedFiles) {
        const { sourceFilesApi } = getClient();

        pxt.debug(`Fetching files`)
        const filesResponse = await sourceFilesApi
            .withFetchAll()
            .listProjectFiles(projectId, {});

        let files = filesResponse.data.map(fileResponse => fileResponse.data);

        if (!files.length) {
            throw new Error("No files found!");
        }

        pxt.debug(`File count: ${files.length}`);
        fetchedFiles = files;
    }

    return fetchedFiles;
}

async function createFile(fileName: string, fileContent: any, directoryId?: number): Promise<SourceFilesModel.File> {
    const { uploadStorageApi, sourceFilesApi } = getClient();

    // This request happens in two parts: first we upload the file to the storage API,
    // then we actually create the file
    const storageResponse = await uploadStorageApi.addStorage(fileName, fileContent);

    const file = await sourceFilesApi.createFile(projectId, {
        storageId: storageResponse.data.id,
        name: fileName,
        directoryId
    });

    // Make sure to add the file to the cache if it exists
    if (fetchedFiles) {
        fetchedFiles.push(file.data);
    }
    return file.data;
}

async function createDirectory(dirName: string, directoryId?: number): Promise<SourceFilesModel.Directory> {
    const { sourceFilesApi } = getClient();

    const dir = await sourceFilesApi.createDirectory(projectId, {
        name: dirName,
        directoryId
    });

    // Make sure to add the directory to the cache if it exists
    if (fetchedDirectories) {
        fetchedDirectories.push(dir.data);
    }
    return dir.data;
}


async function updateFile(fileId: number, fileName: string, fileContent: any): Promise<void> {
    const { uploadStorageApi, sourceFilesApi } = getClient();

    const storageResponse = await uploadStorageApi.addStorage(fileName, fileContent);

    await sourceFilesApi.updateOrRestoreFile(projectId, fileId, {
        storageId: storageResponse.data.id,
    });
}

function getClient() {
    if (!client) {
        client = new crowdin(crowdinCredentials());
    }

    return client;
}

function crowdinCredentials(): Credentials {
    let token: string;
    if (pxt.crowdin.testMode) {
        token = pxt.crowdin.TEST_KEY;
    }
    else {
        token = process.env[pxt.crowdin.KEY_VARIABLE];
    }

    if (!token) {
        throw new Error(`Crowdin token not found in environment variable ${pxt.crowdin.KEY_VARIABLE}`);
    }

    if (pxt.appTarget?.appTheme?.crowdinProjectId !== undefined) {
        setProjectId(pxt.appTarget.appTheme.crowdinProjectId);
    }

    return { token };
}

// calls path.normalize and removes leading slash
function normalizePath(p: string) {
    p = path.normalize(p);
    if (/^[\/\\]/.test(p)) p = p.slice(1)

    return p;
}