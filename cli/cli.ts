/// <reference path="../node_modules/typescript/lib/typescriptServices.d.ts"/>
/// <reference path="../typings/node/node.d.ts"/>
// <reference path="../built/yelmlib.d.ts"/>
/// <reference path="../built/emitter.d.ts"/>

namespace yelm {

    let reportDiagnostic = reportDiagnosticSimply;

    function reportDiagnostics(diagnostics: ts.Diagnostic[]): void {
        for (const diagnostic of diagnostics) {
            reportDiagnostic(diagnostic);
        }
    }

    function reportDiagnosticSimply(diagnostic: ts.Diagnostic): void {
        let output = "";

        if (diagnostic.file) {
            const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
            const relativeFileName = diagnostic.file.fileName;
            output += `${relativeFileName}(${line + 1},${character + 1}): `;
        }

        const category = ts.DiagnosticCategory[diagnostic.category].toLowerCase();
        output += `${category} TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
        console.log(output);
    }

    export function main() {
        let fileNames = process.argv.slice(2)

        let fs = require("fs")

        let fileText: any = {}
        fileNames.forEach(fn => {
            fileText[fn] = fs.readFileSync(fn, "utf8")
        })
        
        let hexinfo = require("../generated/hexinfo.js");

        let res = ts.mbit.compile({
            fileSystem: fileText,
            sourceFiles: fileNames,
            hexinfo: hexinfo
        })

        Object.keys(res.outfiles).forEach(fn =>
            fs.writeFileSync("../built/" + fn, res.outfiles[fn], "utf8"))
        
        reportDiagnostics(res.diagnostics);

        return res.success ?
            ts.ExitStatus.Success :
            ts.ExitStatus.DiagnosticsPresent_OutputsSkipped
    }
}

yelm.main();
