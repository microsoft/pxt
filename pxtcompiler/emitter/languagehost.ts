namespace ts.pxtc {
    export class LSHost implements ts.LanguageServiceHost {
        constructor(private p: ts.Program) { }

        getCompilationSettings(): ts.CompilerOptions {
            const opts = this.p.getCompilerOptions();
            opts.noLib = true;
            return opts;
        }

        getNewLine(): string { return "\n" }

        getScriptFileNames(): string[] {
            return this.p.getSourceFiles().map(f => f.fileName);
        }

        getScriptVersion(fileName: string): string {
            return "0";
        }

        getScriptSnapshot(fileName: string): ts.IScriptSnapshot {
            const f = this.p.getSourceFile(fileName);
            return {
                getLength: () => f.getFullText().length,
                getText: () => f.getFullText(),
                getChangeRange: () => undefined
            };
        }

        getCurrentDirectory(): string { return "."; }

        getDefaultLibFileName(options: ts.CompilerOptions): string { return ""; }

        useCaseSensitiveFileNames(): boolean { return true; }
    }
}