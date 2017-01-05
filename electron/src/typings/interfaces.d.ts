import * as Promise from "bluebird";
import * as http from "http";
import * as stream from "stream";

// General interfaces
export interface Map<T> {
    [key: string]: T;
}

export interface RequestOptions {
    agent?: any;
    data?: any;
    followRedirects?: number;
    headers?: any;
    password?: string;
    strictSSL?: boolean;
    timeout?: number;
    type?: string;
    url?: string;
    user?: string;
}

export interface RequestContext {
    req: http.ClientRequest;
    res: http.ClientResponse;
    stream: stream;
}

export interface Deferred<T> {
    promise: Promise<T>;
    reject: RejectCallback;
    resolve: ResolveCallback<T>;
}

// Electron app interfaces
export interface AppOptions {
    debugWebapp?: boolean;
    debugWebview?: boolean;
    isNpmStart?: boolean;
}

export interface WebviewStartMessage {
    devtools: boolean;
    localtoken: string;
    serverPort: number;
    wsPort: number;
}

export interface UpdaterBase extends NodeJS.EventEmitter {
    checkForUpdates(): void;
    quitAndInstall(): void;
    setFeedURL(url: string): void;
}

export interface VersionInfo {
    banned: string[];
    latest: string;
    prompt: string;
    urls: { [versionRange: string]: string };
}

export interface ReleaseManifest {
    versions: { [major: string]: VersionInfo };
    timestamp?: string;
}

export interface UpdateCacheInfo {
    cachePath: string;
    releaseManifestFileName: string;
    releaseManifestPath: string;
}

export interface UpdateEventInfo {
    appName?: string;
    isCritical?: boolean;
    isInitialCheck?: boolean;
    targetVersion?: string;
}

export interface Update {
    url: string;
    version: string;
}

// PXT interfaces
export interface PxtCore {
    globalConfig: {
        localToken: string;
    };
    mainCli: (targetDir: string, args?: string[], electronListeners?: Map<ElectronHandler>) => Promise<void>;
    sendElectronMessage: (message: ElectronMessage) => void;
}

export interface ElectronMessage {
    type: string;
    args?: any;
}

export interface ElectronHandler { (args?: any): void }

// Target interfaces
export interface ProductInformation {
    applicationName: string;
    dataFolderName: string;
    darwinBundleIdentifier: string;
    icons: { [platform: string]: string };
    nameShort: string;
    nameLong: string;
    updateTag: string;
    releaseManifestUrl?: string;
    targetId: string;
    updateDownloadUrl?: string;
    version?: string;
    win32AppId: string;
    win32AppUserModelId: string;
    win32DirName: string;
    win32MutexName: string;
    win32NameVersion: string;
    win32RegValueName: string;
}

// Third-party interfaces
//     Bluebird
export interface RejectCallback {
    (error: any): void;
}

export interface ResolveCallback<T> {
    (thenableOrResult?: T | PromiseLike<T>): void;
}