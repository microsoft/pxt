namespace pxt {
    export interface Logger {
        info(...args: any[]): void;
        log(...args: any[]): void;
        debug(...args: any[]): void;
        error(...args: any[]): void;
        warn(...args: any[]): void;

        setLogLevel(level: LogLevel): void;
        getLogLevel(): LogLevel;
    }

    export enum LogLevel {
        Debug = 0,
        Info = 1,
        Log = 1,
        Warning = 2,
        Error = 3
    }

    export class ConsoleLogger implements Logger {
        protected logLevel: LogLevel;

        constructor() {
            this.setLogLevel(LogLevel.Info);
        }

        setLogLevel(level: LogLevel): void {
            this.logLevel = level;
        }

        getLogLevel(): LogLevel {
            return this.logLevel;
        }

        info(...args: any[]): void {
            if (!this.shouldLog(LogLevel.Info)) return;

            if (console?.info) {
                console.info.call(null, ...args);
            }
        }

        log(...args: any[]): void {
            if (!this.shouldLog(LogLevel.Log)) return;

            if (console?.log) {
                console.log.call(null, ...args);
            }
        }

        debug(...args: any[]): void {
            if (!this.shouldLog(LogLevel.Debug)) return;

            if (console?.debug) {
                console.debug.call(null, ...args);
            }
        }

        error(...args: any[]): void {
            if (!this.shouldLog(LogLevel.Error)) return;

            if (console?.error) {
                console.error.call(null, ...args);
            }
        }

        warn(...args: any[]): void {
            if (!this.shouldLog(LogLevel.Warning)) return;

            if (console?.warn) {
                console.warn.call(null, ...args);
            }
        }

        protected shouldLog(level: LogLevel) {
            return level >= this.logLevel;
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
        const level = logger?.getLogLevel();
        logger = impl;
        if (level !== undefined) {
            logger.setLogLevel(level);
        }
    }

    export function setLogLevel(level: LogLevel) {
        logger.setLogLevel(level);
    }
}