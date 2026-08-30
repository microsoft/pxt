/*
 * Compares two hw-ab serial captures.
 *
 * Only the lines that carry a verdict or a trace are compared: HWAB banners,
 * ASSERT failures, and the prelude's own msg() progress lines. Everything a
 * capture picks up incidentally is dropped, and the parts of a line that vary
 * legitimately between two runs of the same build -- elapsed milliseconds and
 * heap byte counts on soak lines -- are masked before the comparison.
 */

"use strict";

const fs = require("fs");

const USAGE = [
    "Usage: node tests/hw-ab/diff-ab.js <log-a> <log-b>",
    "",
    "Normalizes two run-capture.js logs and diffs them.",
    "",
    "Normalization:",
    "  - CR stripped, blank lines dropped",
    "  - everything before the first \"HWAB START\" banner is discarded, since a",
    "    capture can attach part way through a line",
    "  - HWAB banners, ASSERT failures and the lang-test0 msg() trace lines are all",
    "    compared; a leading \"[12345]\" or \"123ms\" timestamp is stripped",
    "  - \"HWAB SOAK <ms> free=.. min=.. total=.. numgc=..\" collapses to",
    "    \"HWAB SOAK <t> <heap>\" -- soak timing and heap numbers vary between runs",
    "    and are not a divergence",
    "  - repeated identical lines collapse to one (the PASS banner and the START",
    "    banner both repeat by design)",
    "",
    "Soak heap trend is out of scope. The final heap line from each log is printed",
    "side by side so the two can be eyeballed, but it does not affect the exit code.",
    "",
    "Exit codes: 0 identical, 1 divergence (a unified diff is printed), 2 usage."
].join("\n");

function usage(stream) {
    stream.write(USAGE + "\n");
}

// Splits file text into lines the way the line tools do: a trailing newline
// terminates the last line rather than starting an empty one, while a final
// unterminated fragment is still a line.
function splitLines(text) {
    const lines = text.split("\n");
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    return lines;
}

function normalize(file) {
    const raw = splitLines(fs.readFileSync(file, "utf8").replace(/\r/g, ""));

    // Serial capture can attach part way through a line, so the sync point is
    // the first HWAB START banner; everything before it is discarded. A log
    // with no banner at all (capture attached after the program had run) keeps
    // all of its lines except the first, which is the one that can be a
    // fragment.
    let start = 0;
    for (let i = 0; i < raw.length; i++) {
        if (raw[i].indexOf("HWAB START") >= 0) { start = i + 1; break; }
    }
    const from = start ? start : 2;

    const out = [];
    let prev = null;
    for (let i = from - 1; i < raw.length; i++) {
        const line = raw[i]
            .replace(/^\[[0-9]+\][ \t]*/, "")
            .replace(/^[0-9]+ms[ \t]+/, "")
            .replace(/^HWAB SOAK [0-9]+ .*$/, "HWAB SOAK <t> <heap>");
        // Blank lines are dropped without resetting the duplicate filter.
        if (!/[^ \t]/.test(line)) continue;
        if (line === prev) continue;
        out.push(line);
        prev = line;
    }
    return out;
}

function finalHeap(file) {
    const lines = splitLines(fs.readFileSync(file, "utf8").replace(/\r/g, ""));
    let last = "";
    for (const line of lines) {
        if (line.indexOf("HWAB SOAK ") >= 0) last = line;
    }
    return last || "(no soak lines)";
}

// Longest common subsequence over whole lines; the logs compared here are a few
// hundred lines at most, so the quadratic table is not worth avoiding.
function lcsTable(a, b) {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const table = new Uint32Array(rows * cols);
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            table[i * cols + j] = a[i] === b[j]
                ? table[(i + 1) * cols + (j + 1)] + 1
                : Math.max(table[(i + 1) * cols + j], table[i * cols + (j + 1)]);
        }
    }
    return table;
}

// Returns the edit script as {op, line} entries, op in " ", "-", "+".
function diffLines(a, b) {
    const cols = b.length + 1;
    const table = lcsTable(a, b);
    const script = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            script.push({ op: " ", line: a[i] }); i++; j++;
        } else if (table[(i + 1) * cols + j] >= table[i * cols + (j + 1)]) {
            script.push({ op: "-", line: a[i] }); i++;
        } else {
            script.push({ op: "+", line: b[j] }); j++;
        }
    }
    while (i < a.length) script.push({ op: "-", line: a[i++] });
    while (j < b.length) script.push({ op: "+", line: b[j++] });
    return script;
}

// A range of zero lines is reported against the line before it, and a range of
// one line omits the count -- the conventions unified diff readers expect.
function range(start, len) {
    if (len === 0) return (start - 1) + ",0";
    if (len === 1) return String(start);
    return start + "," + len;
}

function unifiedDiff(a, b, labelA, labelB, context) {
    const script = diffLines(a, b);
    if (!script.some(e => e.op !== " ")) return null;

    // Group the script into hunks: every changed entry plus `context` unchanged
    // entries on each side, merged when their context windows touch.
    const changed = [];
    script.forEach((e, idx) => { if (e.op !== " ") changed.push(idx); });
    const hunks = [];
    let k = 0;
    while (k < changed.length) {
        let lo = Math.max(0, changed[k] - context);
        let hi = Math.min(script.length - 1, changed[k] + context);
        k++;
        while (k < changed.length && changed[k] - context <= hi + 1) {
            hi = Math.min(script.length - 1, changed[k] + context);
            k++;
        }
        hunks.push([lo, hi]);
    }

    // Lines of each file consumed before each script entry, so a hunk header
    // can name the 1-based line each side starts at.
    const aBefore = new Array(script.length);
    const bBefore = new Array(script.length);
    let an = 0, bn = 0;
    script.forEach((e, idx) => {
        aBefore[idx] = an;
        bBefore[idx] = bn;
        if (e.op !== "+") an++;
        if (e.op !== "-") bn++;
    });

    const out = ["--- " + labelA, "+++ " + labelB];
    for (const [lo, hi] of hunks) {
        let aLen = 0, bLen = 0;
        for (let idx = lo; idx <= hi; idx++) {
            if (script[idx].op !== "+") aLen++;
            if (script[idx].op !== "-") bLen++;
        }
        out.push("@@ -" + range(aBefore[lo] + 1, aLen) +
                 " +" + range(bBefore[lo] + 1, bLen) + " @@");
        for (let idx = lo; idx <= hi; idx++) {
            out.push(script[idx].op + script[idx].line);
        }
    }
    return out.join("\n") + "\n";
}

function main(argv) {
    if (argv.length !== 2) { usage(process.stderr); return 2; }
    for (const f of argv) {
        let ok = false;
        try { ok = fs.statSync(f).isFile(); } catch (e) { ok = false; }
        if (!ok) {
            process.stderr.write("diff-ab: no such log: " + f + "\n");
            return 2;
        }
    }

    const a = argv[0];
    const b = argv[1];
    const na = normalize(a);
    const nb = normalize(b);

    if (na.concat(nb).some(l => l.indexOf("HWAB SOAK") >= 0)) {
        process.stdout.write("diff-ab: final soak line\n");
        process.stdout.write("  A (" + a + "): " + finalHeap(a) + "\n");
        process.stdout.write("  B (" + b + "): " + finalHeap(b) + "\n");
        process.stdout.write("\n");
    }

    const d = unifiedDiff(na, nb, "A " + a, "B " + b, 3);
    if (!d) {
        process.stdout.write(
            "diff-ab: identical (" + na.length + " normalized line(s))\n");
        return 0;
    }

    process.stderr.write("diff-ab: DIVERGENCE\n");
    process.stderr.write(d);
    return 1;
}

process.exitCode = main(process.argv.slice(2));
