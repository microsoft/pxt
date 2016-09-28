// @case: wrong identifier in conditional
let y = 0
for (let x = 0; y <= 5; x++) {}

// @case: non binary expression
for (let x = 0; false; x++) {}

// @case: binary expression with bad operator
for (let x = 0; x == 2; x++) {}

// @case: non identifier on left side
for (let x = 0; 2 <= 2; x++) {}

// @case: missing conditional
for (let x = 0; ; x++) {}