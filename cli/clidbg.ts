import * as hid from './hid';
import * as fs from "fs";

import Cloud = pxt.Cloud;
import U = pxt.Util;
import D = pxt.HWDBG;


export function startAsync(compileRes: pxtc.CompileResult) {
    return hid.initAsync()
        .then(d => {
            hid.connectSerial(d)

            D.postMessage = msg => {
                if (msg.subtype != "breakpoint") {
                    console.log(msg)
                    return
                }
                let bmsg = msg as pxsim.DebuggerBreakpointMessage

                console.log("GLOBALS", bmsg.globals)
                for (let s of bmsg.stackframes)
                    console.log(s.funcInfo.functionName, s.locals)

                let brkMatch = compileRes.breakpoints.filter(b => b.id == bmsg.breakpointId)[0]
                if (!brkMatch) {
                    console.log("Invalid breakpoint ID", msg)
                    return
                }
                let lines = fs.readFileSync(brkMatch.fileName, "utf8").split(/\n/)

                console.log(">>>", lines.slice(brkMatch.line, brkMatch.endLine + 1).join(" ;; "))
                Promise.delay(500)
                    .then(() => D.resumeAsync(false))
            }

            return D.startDebugAsync(compileRes, d)
        })
}