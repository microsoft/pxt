// @case: expression other than variable declaration
let x = 0;
for (1 + 1; x <= 5; x++) {}

// @case: missing initializer
let x2 = 0;
for (; x2 <= 5; x2++) {}

// @case: more than one variable declaration in initializer
for (let x = 0, y = 2; x <= 5; x++) {}