/// <reference path="../../built/pxtlib.d.ts"/>
importScripts(
    "/cdn/typescript.js",
    "/cdn/fuse.min.js",
    "/cdn/pxtlib.js"
)

let pm: any = postMessage;

// work around safari not providing atob
if (typeof atob === "undefined") {
    // http://www.rise4fun.com/Bek/base64encode
    pxtc.decodeBase64 = function (_input: string): string {
        function _base64(_x: number): number { return ((_x <= 0x19) ? (_x + 0x41) : ((_x <= 0x33) ? (_x + 0x47) : ((_x <= 0x3D) ? (_x - 0x4) : ((_x == 0x3E) ? 0x2B : 0x2F)))); };
        let result = new Array();
        let _q = 0x0;
        let _r = 0x0;
        for (let _i = 0; _i < _input.length; _i++) {
            let _x = _input.charCodeAt(_i);
            if ((_x > 0xFF)) {
                //throw { name: 'InvalidCharacter' };
                return undefined;
            }
            else if ((_q == 0x0)) {
                result.push(String.fromCharCode(_base64((_x >> 0x2))));
                _q = 0x1;
                _r = ((_x & 0x3) << 0x4);
            }
            else if ((_q == 0x1)) {
                result.push(String.fromCharCode(_base64((_r | (_x >> 0x4)))));
                _q = 0x2;
                _r = ((_x & 0xF) << 0x2);
            }
            else if ((_q == 0x2)) {
                result.push(String.fromCharCode(_base64((_r | (_x >> 0x6))), _base64((_x & 0x3F))));
                _q = 0x0;
                _r = 0x0;
            }
        }
        if ((_q == 0x1)) {
            result.push(String.fromCharCode(_base64(_r), 0x3D, 0x3D));
        }
        else if ((_q == 0x2)) {
            result.push(String.fromCharCode(_base64(_r), 0x3D));
        }
        return result.join('');
    }
}

onmessage = ev => {
    let res = pxtc.service.performOperation(ev.data.op, ev.data.arg)
    pm({
        op: ev.data.op,
        id: ev.data.id,
        result: JSON.parse(JSON.stringify(res))
    })
}

pm({
    id: "ready"
})
