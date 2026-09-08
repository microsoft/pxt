/*
 * Compares two hw-ab serial captures.
 *
 * Only the lines that carry a verdict or a trace are compared: HWAB banners,
 * ASSERT failures, and the prelude's own msg() progress lines. Everything a
 * capture picks up incidentally is dropped, and the parts of a line that vary
 * legitimately between two runs of the same build -- elapsed milliseconds and
 * heap byte counts on soak lines -- are masked before the comparison.
 *
 * Two capture artifacts are also dropped, since both are properties of the
 * capture rather than of the build: a final line the capture cut short, and a
 * banner belonging to the previously flashed program.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const USAGE = [
    "Usage: node tests/hw-ab/diff-ab.js <log-a> <log-b> [--case <name>]",
    "",
    "Normalizes two run-capture.js logs and diffs them.",
    "",
    "Normalization:",
    "  - CR stripped, blank lines dropped",
    "  - the expected case comes from --case, else from the log's parent",
    "    directory (the out/<case>/<side>.log layout); everything before its",
    "    \"HWAB START <case>\" banner is discarded, including a stale prefix glued",
    "    to the banner line. DAPLink's buffer can hold a previous program's",
    "    entire run, START banner included, so content cannot name its own case.",
    "    With no --case and no such banner, the first START of any case is the",
    "    sync point.",
    "  - an unterminated final line is dropped -- it means the capture stopped",
    "    mid-line, which is not a divergence",
    "  - HWAB lines naming a different case are the previous program's, buffered",
    "    by DAPLink, and are dropped",
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

// Case name carried by an "HWAB START <case>" or "HWAB PASS <case>" line, or
// "" for any other line (HWAB SOAK carries no case name).
function hwabCase(line) {
    const m = /HWAB (?:START|PASS)[ \t]+([^ \t]+)/.exec(line);
    return m ? m[1] : "";
}

function normalize(file, expectedCase) {
    const text = fs.readFileSync(file, "utf8").replace(/\r/g, "");
    const raw = splitLines(text);

    // A capture stopped mid-line leaves an unterminated fragment; where the
    // capture happened to stop is not a divergence.
    if (raw.length && !/\n$/.test(text)) raw.pop();

    // Serial capture can attach part way through a line, and DAPLink's buffer
    // can hold a previous program's entire run, START banner included -- so
    // when the expected case is known, the sync point is ITS banner, and a
    // stale fragment glued to the front of that line is cut off. Only with no
    // expected case (or a log that never prints its banner) does the first
    // START of any case stand in. A log with no banner at all keeps all of
    // its lines except the first, which is the one that can be a fragment.
    let start = 0;
    let caseName = "";
    const wanted = expectedCase ? "HWAB START " + expectedCase : null;
    for (let i = 0; i < raw.length; i++) {
        const at = wanted ? raw[i].indexOf(wanted) : -1;
        if (at >= 0) {
            raw[i] = raw[i].substr(at);
            start = i + 1;
            caseName = expectedCase;
            break;
        }
        if (!wanted && raw[i].indexOf("HWAB START") >= 0) {
            start = i + 1;
            caseName = hwabCase(raw[i]);
            break;
        }
    }
    if (!start && wanted) {
        // Expected banner never seen: fall back to any-case sync so a log from
        // outside the out/<case>/ layout still normalizes.
        for (let i = 0; i < raw.length; i++) {
            if (raw[i].indexOf("HWAB START") >= 0) {
                start = i + 1;
                caseName = hwabCase(raw[i]);
                break;
            }
        }
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
        // A whole banner from the previously flashed program can survive the
        // discard above, buffered by DAPLink and emitted after this program's
        // own START. It names the other case, which is how it is recognised.
        const lineCase = hwabCase(line);
        if (caseName && lineCase && lineCase !== caseName) continue;
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
    let expectedCase = "";
    const files = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--case") {
            if (i + 1 >= argv.length) { usage(process.stderr); return 2; }
            expectedCase = argv[++i];
        } else {
            files.push(argv[i]);
        }
    }
    if (files.length !== 2) { usage(process.stderr); return 2; }
    for (const f of files) {
        let ok = false;
        try { ok = fs.statSync(f).isFile(); } catch (e) { ok = false; }
        if (!ok) {
            process.stderr.write("diff-ab: no such log: " + f + "\n");
            return 2;
        }
    }

    const a = files[0];
    const b = files[1];
    // Without --case, the out/<case>/<side>.log layout names the case; a log
    // from elsewhere falls back to content sync inside normalize().
    if (!expectedCase) expectedCase = path.basename(path.dirname(a));
    const na = normalize(a, expectedCase);
    const nb = normalize(b, expectedCase);

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
