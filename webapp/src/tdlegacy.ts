import * as core from "./core";
import * as pkg from "./package";
import * as compiler from "./compiler"

import Cloud = pxt.Cloud;
import U = pxt.Util;

let iface: pxt.worker.Iface

export function td2tsAsync(td: string) {
    if (!iface) iface = pxt.worker.makeWebWorker(pxt.webConfig.tdworkerjs)

    return pkg.mainPkg.getCompileOptionsAsync()
        .then((opts) => {
            opts.ast = true
            return compiler.workerOpAsync("compileTd", {options: opts});
        })
        .then(apiinfo => {
            let arg = {
                text: td,
                useExtensions: true,
                apiInfo: apiinfo
            }
            return iface.opAsync("td2ts", arg)
        })
        .then(resp => {
            pxt.debug(resp)
            return resp.text as string
        })
}