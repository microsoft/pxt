// Default if/then/else blocks
if (true) {}
if (true) {} else {}
if (false) {} else if (true) {} else {}
if (false) {} else if (true) {}

// Conditionals that are expressions
let x = true || false

if ((x || true) && 2 == 4) {}
if (x) {} else {}

// Truthy/Falsy variables
let y = 0
if (y) {}

// If/then/else with body
if (!!true) {
    y = 2 + 7;
    x = !!false;
} else if (!!true) {
    y = 23 + 4;
    x = !!true;
} else {
    y = 2 + 7;
    x = !!false && true;
}

// No curly braces
if (!!true)
y = 2 + 3
else if (!! true)
y = 7 * 4
else
y = 0