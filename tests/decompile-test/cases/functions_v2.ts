function shouldDecompile1() {}

function shouldDecompile2() { return; }

function shouldDecompile3(a: number, b: string, c: boolean) { }

function hasReturnType() { return 5; }
function hasReturnTypeAndArgs(a: number) { return 5; }

let x = function () {}

let y = function expressionFunction() {}

if (true) {
    function scopedFunction() {

    }
}