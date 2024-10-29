namespace pxt {
    export interface Logger {
        info(...args: any[]): void;
        log(...args: any[]): void;
        debug(...args: any[]): void;
        error(...args: any[]): void;
        warn(...args: any[]): void;
    }

    class ConsoleLogger implements Logger {
        info(...args: any[]): void {
            if (console?.info) {
                console.info.call(null, ...args);
            }
        }

        log(...args: any[]): void {
            if (console?.log) {
                console.log.call(null, ...args);
            }
        }

        debug(...args: any[]): void {
            if (console?.debug) {
                console.debug.call(null, ...args);
            }
        }

        error(...args: any[]): void {
            if (console?.error) {
                console.error.call(null, ...args);
            }
        }

        warn(...args: any[]): void {
            if (console?.warn) {
                console.warn.call(null, ...args);
            }
        }
    }

    let logger: Logger = new ConsoleLogger();

    export function info(...args: any[]): void {
        logger.info(...args);
    }

    export function log(...args: any[]): void {
        logger.log(...args);
    }

    export function debug(...args: any[]): void {
        logger.debug(...args);
    }

    export function error(...args: any[]): void {
        logger.error(...args);
    }

    export function warn(...args: any[]): void {
        logger.warn(...args);
    }

    export function setLogger(impl: Logger) {
        logger = impl;
    }
}