namespace pxsim.util {
    export class Lazy<T> {
        private _value: T;
        private _evaluated = false;

        constructor(private _func: () => T) {}

        get value(): T {
            if (!this._evaluated) {
                this._value = this._func();
                this._evaluated = true;
            }
            return this._value;
        }
    }

    export function getNormalizedParts(path: string): string[] {
        path = path.replace(/\\/g, "/");

        const parts: string[] = [];
        path.split("/").forEach(part => {
            if (part === ".." && parts.length) {
                parts.pop();
            }
            else if (part && part !== ".") {
                parts.push(part)
            }
        });

        return parts;
    }

    export function normalizePath(path: string): string {
        return getNormalizedParts(path).join("/");
    }

    export function relativePath(fromDir: string, toFile: string): string {
        const fParts = getNormalizedParts(fromDir);
        const tParts = getNormalizedParts(toFile);

        let i = 0;
        while (fParts[i] === tParts[i]) {
            i++;
            if (i === fParts.length || i === tParts.length) {
                break;
            }
        }

        const fRemainder = fParts.slice(i);
        const tRemainder = tParts.slice(i);
        for (let i = 0; i <  fRemainder.length; i++) {
            tRemainder.unshift("..");
        }

        return tRemainder.join("/");
    }

    export function pathJoin(...paths: string[]): string {
        let result = "";
        paths.forEach(path => {
            path.replace(/\\/g, "/");
            if (path.lastIndexOf("/") === path.length - 1) {
                path = path.slice(0, path.length - 1)
            }
            result += "/" + path;
        });
        return result;
    }
}