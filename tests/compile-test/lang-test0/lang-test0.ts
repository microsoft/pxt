

//
// Note that this is supposed to run from command line.
// Do not use anything besides pause, control.runInBackground, console.log
//

pause(2000)

function msg(s: string): void {
    control.__log(s)
    control.__log("\n")
    control.dmesg(s)
    //serial.writeString(s)
    //serial.writeString("\n")
    //pause(50);
}

msg("start!")

function assert(cond: boolean, m?: string) {
    if (!cond) {
        msg("assertion failed: ")
        if (m)
            msg(m)
        while (1) {
            pause(1000)
        }
    }
}

//
// start tests
//

let glb1: number;
let s2: string;
let x: number;
let action: Action;
let tot: string;
let lazyAcc: number;
let sum: number;
let u8: uint8
let i8: int8
let u16: uint16
let i16: int16

let xyz = 12;


let hasFloat = true
if ((1 / 10) == 0) {
    hasFloat = false
}

class Testrec {
    str: string;
    num: number;
    bool: boolean;
    str2: string;
}

function testFloat() {
    if (!hasFloat)
        return
    let v = 13 / 32
    v *= 32
    assert(v == 13, "/")
    for (let i = 0; i < 20; ++i) {
        v *= 10000
    }
    //assert(v > 1e81, "81")
}

function clean() {
    glb1 = 0
    s2 = ""
    x = 0
    action = null
    tot = ""
    lazyAcc = 0
    sum = 0
}



testFloat()

