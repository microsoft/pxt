if (true) {}
if (true) {} else {}
if (false) {} else if (true) {} else {}
if (false) {} else if (true) {}

let x = true || false

if ((x || true) && (2 + 3) == 4) {}
if (x) {} else {}

let y = 1
if (y) {}

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

if (!!true)
y = 2 + 3
else if (!! true)
y = 7 * 4
else
y = 0