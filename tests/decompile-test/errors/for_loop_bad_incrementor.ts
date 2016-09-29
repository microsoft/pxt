// @case: unsupported incrementor expression
for (let x = 0; x <= 5; x+= 1) {}

// @case: minus minus in incrementor
for (let x = 0; x <= 5; x--) {}

// @case: wrong variable in incrementor
let y = 0;
for (let x = 0; x <= 5; y++) {}

// @case: missing incrementor
for (let x = 0; x <= 5;) {}