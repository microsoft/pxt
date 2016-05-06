import * as core from "./core";
import * as workeriface from "./workeriface"
import * as pkg from "./package";

import Cloud = pxt.Cloud;
import U = pxt.Util;

let iface: workeriface.Iface

export function td2tsAsync(td: string) {
    if (!iface) iface = workeriface.makeWebWorker(pxt.webConfig.tdworkerjs)

    return pkg.mainPkg.getCompileOptionsAsync()
        .then(opts => {
            opts.ast = true
            let res = ts.pxt.compile(opts)
            let apiinfo = ts.pxt.getApiInfo(res.ast)
            let arg = {
                text: td,
                useExtensions: true,
                apiInfo: apiinfo
            }
            return iface.opAsync("td2ts", arg)
        })
        .then(resp => {
            console.log(resp)
            return resp.text as string
        })
}