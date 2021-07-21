import * as fs from 'fs';
import * as path from 'path';
import { promisify } from "util";

import U = pxt.Util;

const rootPath = path.resolve('.pxt', 'storage');
const mkdirAsync = promisify(fs.mkdir);
const unlinkAsync = promisify(fs.unlink);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

export type Record = {
    type: "json" | "text",
    val: string;
};

async function initAsync() {
    try {
        await mkdirAsync(rootPath, { recursive: true });
    } catch (err) {
        pxt.debug(err);
    }
}

export async function getAsync<T>(container: string, key: string): Promise<T | undefined> {
    await initAsync();
    try {
        const fname = path.resolve(rootPath, sanitize(container), sanitize(key));
        pxt.debug(`GET ${fname}`);
        const srec = (await readFileAsync(fname)).toString("utf8");
        const rec = JSON.parse(srec) as Record;
        let val: any;
        if (rec.type === "json")
            val = JSON.parse(rec.val);
        else
            val = rec.val;
        return Promise.resolve<T>(val);
    } catch (err) {
        pxt.debug(err);
    }
    return undefined;
}

export async function setAsync(container: string, key: string, rec: Record): Promise<void> {
    await initAsync();
    try {
        const dir = path.resolve(rootPath, sanitize(container));
        const fname = path.resolve(dir, sanitize(key));
        pxt.debug(`SET ${fname}`);
        const srec = JSON.stringify(rec);
        try { await mkdirAsync(path.resolve(rootPath, dir)); } catch { }
        await writeFileAsync(fname, srec);
    } catch (err) {
        pxt.debug(err);
    }
}

export async function delAsync(container: string, key: string): Promise<void> {
    await initAsync();
    try {
        const p = path.resolve(rootPath, sanitize(container), sanitize(key));
        pxt.debug(`DEL ${p}`);
        await unlinkAsync(p);
    } catch (err) {
        pxt.debug(err);
    }
}

const whitespaceRe = /[\r\n\s\t]+/g;
const illegalRe = /[\/\?<>\\:\*\|"]/g;
// eslint-disable-next-line no-control-regex
const controlRe = /[\x00-\x1f\x80-\x9f]/g; // https://en.wikipedia.org/wiki/C0_and_C1_control_codes
const reservedRe = /^\.+$/;
const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const windowsTrailingRe = /[\. ]+$/;

function sanitize(path: string): string {
    path = path
        .replace(whitespaceRe, '-')
        .replace(illegalRe, '-')
        .replace(controlRe, '-')
        .replace(reservedRe, '-')
        .replace(windowsReservedRe, '-')
        .replace(windowsTrailingRe, '-');
    U.assert(path.length > 0);
    return path;
}
