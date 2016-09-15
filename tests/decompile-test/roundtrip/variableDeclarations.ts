// Declared with no type annotation
let j = 5;
var f = 5;
const l = 5;

// Declared with type annotation

let i: number = 0;
var k: number = 0;
const o: number = 0;

// Declared and initialized but never used
let s = 5;
var d = 5;
const e = 5;

// Declared with no initializer
let t: number;
var n: number;

// Declared with no initializer and never used
let w: number;
var p: number;

if (o == 90) {
    // Declared in a non-global scope
    let k = 2;
    var x = 2;
    j = 9 + 7;
    i = 8 + x;
    k = 2 + 3;
    t = o + l + k + f + d + n;
}

// Declared in a for loop initializer
for (let m = 0; m < 5; m++) {}
for (var m = 0; m < 5; m++) {}

// Declaration lists
let u = 5, v = 6;
var q = 0, g = 8;
const a = 9, b = false;

// Redeclared variables
var r = 9;
var r = 2 + 3;