/// <reference path="../../built/pxtlib.d.ts"/>
/// <reference path="../../built/pxtcompiler.d.ts"/>

importScripts(
    "/blb/typescript.js",
    "/blb/fuse.min.js",
    "/blb/pxtlib.js",
    "/blb/pxtcompiler.js"
)

let pm: any = postMessage;

// work around safari not providing bota
if (typeof btoa === "undefined") {
    // http://www.rise4fun.com/Bek/base64encode
    ts.pxtc.encodeBase64 = function (_input: string): string {
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

// work around safari not providing atob
if (typeof atob === "undefined") {
    //http://www.rise4fun.com/Bek/Cbl
    ts.pxtc.decodeBase64 = function (_input: string): string {
        function _D(_x: number): number { return ((_x == 0x2F) ? 0x3F : ((_x == 0x2B) ? 0x3E : ((_x <= 0x39) ? (_x + 0x4) : ((_x <= 0x5A) ? (_x - 0x41) : (_x - 0x47))))); };

        function _Bits(m: number, n: number, c: number): number {
            let mask = 0;
            for (let i = 0; i <= (m - n); i++) { mask = (mask << 1) + 1; }
            return (c >> n) & mask;
        };
        let result = new Array();
        let _q0 = true;
        let _q1 = false;
        let _q2 = false;
        let _q3 = false;
        let _q4 = false;
        let _q5 = false;
        let _r = 0x0;
        let rx = new RegExp("^([A-Za-z0-9+/=])$");
        for (let _i = 0; _i < _input.length; _i++) {
            let _x = _input.charCodeAt(_i);
            if ((!String.fromCharCode(_x).match(rx) || ((_x == 0x3D) && (_q0 || _q1)) || ((_x == 0x3D) && !(_r == 0x0)) || (!(_x == 0x3D) && _q4) || _q5)) {
                // throw { name: 'InvalidInput' };
                return undefined;
            }
            else if (_q0) {
                _r = (_D(_x) << 0x2);
                _q0 = false;
                _q1 = true;
                _q2 = false;
                _q3 = false;
                _q4 = false;
                _q5 = false;
            }
            else if (_q1) {
                result.push(String.fromCharCode((_r | _Bits(0x5, 0x4, _D(_x)))));
                _r = ((_D(_x) & 0xF) << 0x4);
                _q0 = false;
                _q1 = false;
                _q2 = true;
                _q3 = false;
                _q4 = false;
                _q5 = false;
            }
            else if (_q2) {
                if ((_x == 0x3D)) {
                    _r = 0x0;
                    _q0 = false;
                    _q1 = false;
                    _q2 = false;
                    _q3 = false;
                    _q4 = true;
                    _q5 = false;
                }
                else {
                    result.push(String.fromCharCode((_r | _Bits(0x5, 0x2, _D(_x)))));
                    _r = ((_D(_x) & 0x3) << 0x6);
                    _q0 = false;
                    _q1 = false;
                    _q2 = false;
                    _q3 = true;
                    _q4 = false;
                    _q5 = false;
                }
            }
            else if (_q3) {
                if ((_x == 0x3D)) {
                    _r = 0x0;
                    _q0 = false;
                    _q1 = false;
                    _q2 = false;
                    _q3 = false;
                    _q4 = false;
                    _q5 = true;
                }
                else {
                    result.push(String.fromCharCode((_r | _D(_x))));
                    _r = 0x0;
                    _q0 = true;
                    _q1 = false;
                    _q2 = false;
                    _q3 = false;
                    _q4 = false;
                    _q5 = false;
                }
            }
            else if (_q4) {
                _r = 0x0;
                _q0 = false;
                _q1 = false;
                _q2 = false;
                _q3 = false;
                _q4 = false;
                _q5 = true;
            }
        }
        if (!(_q0 || _q5)) {
            //throw { name: 'InvalidInput' };
            return undefined;
        }
        const r = result.join('');
        return r;
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
