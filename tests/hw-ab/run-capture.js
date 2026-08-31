/*
 * Flashes a hex to an attached micro:bit and captures its serial output.
 *
 * micro:bit boards speak USB-CDC through DAPLink. No pxt CLI command can attach
 * to that (pxt console / hidserial are HF2-only), so the capture is done by
 * setting the line discipline with the platform's own tool (stty / mode) and
 * reading the device directly.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const VOLUME_WAIT = 30;     // seconds to wait for the board to appear
const REMOUNT_WAIT = 60;    // seconds to wait for the board to come back after flashing
const UNMOUNT_GRACE = 15;   // seconds to wait for the drive to go away while programming

const USAGE = [
    "Usage: node tests/hw-ab/run-capture.js <hex> <logfile> [--timeout <sec>]",
    "           [--soak <minutes>] [--expect <case>]",
    "",
    "Copies <hex> to the attached micro:bit, waits for it to re-enumerate, opens its",
    "USB-CDC serial device at 115200 8N1 raw, and appends everything it prints to",
    "<logfile>.",
    "",
    "Verdicts are read only from the first \"HWAB START\" banner onward: DAPLink",
    "buffers serial while no host is reading, so the first bytes after opening the",
    "port can belong to the previously flashed program -- including its PASS",
    "banner. --expect <case> additionally requires the banner (and the verdict) to",
    "name that case.",
    "",
    "Normal mode (default, --timeout 120):",
    "  stops at the first \"HWAB PASS\" or \"ASSERT\" line, or at the timeout. A",
    "  timeout with no banner at all means the program never ran -- usually a flash",
    "  DAPLink rejected -- so the whole flash and capture is retried once, and only",
    "  the second result is reported. Budget twice the timeout for that case.",
    "  exit 0  HWAB PASS seen",
    "  exit 1  ASSERT seen (the failing line is printed)",
    "  exit 2  timeout with neither",
    "  exit 3  no board, no serial device, or more than one serial device",
    "",
    "Soak mode (--soak <minutes>):",
    "  captures for the whole duration and then checks whether HWAB SOAK lines were",
    "  still arriving at the end.",
    "  exit 0  still printing",
    "  exit 1  output stalled (the program panicked or hung)",
    "",
    "Platforms: macOS, Linux and Windows are detected automatically (where the drive",
    "mounts, how the serial device is named, which tool sets the line settings).",
    "When discovery needs help -- an unusual mount point, several serial devices --",
    "override it:",
    "  MICROBIT_VOLUME  path or drive of the mounted MICROBIT drive",
    "  MICROBIT_SERIAL  serial device to read (/dev/cu.usbmodem1102, COM5, ...)",
    "See the Platforms section of tests/hw-ab/README.md."
].join("\n");

function usage(stream) {
    stream.write(USAGE + "\n");
}

function fail(msg) {
    process.stderr.write("run-capture: " + msg + "\n");
    process.exit(3);
}

// ---- arguments ------------------------------------------------------------

const argv = process.argv.slice(2);
if (argv.indexOf("-h") >= 0 || argv.indexOf("--help") >= 0) {
    usage(process.stdout);
    process.exit(0);
}
if (argv.length < 2) {
    usage(process.stderr);
    process.exit(3);
}

const hex = argv[0];
const logFile = argv[1];
let timeout = 120;
let soakMin = 0;
let expectCase = "";

for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--timeout") {
        if (i + 1 >= argv.length) fail("--timeout needs a value");
        timeout = argv[++i];
    } else if (arg === "--soak") {
        if (i + 1 >= argv.length) fail("--soak needs a value");
        soakMin = argv[++i];
    } else if (arg === "--expect") {
        if (i + 1 >= argv.length) fail("--expect needs a value");
        expectCase = argv[++i];
    } else {
        usage(process.stderr);
        fail("unknown argument: " + arg);
    }
}

let hexIsFile = false;
try { hexIsFile = fs.statSync(hex).isFile(); } catch (e) { hexIsFile = false; }
if (!hexIsFile) fail("no such hex: " + hex);
if (!/^[0-9]+$/.test(String(timeout))) fail("--timeout must be an integer");
if (!/^[0-9]+$/.test(String(soakMin))) fail("--soak must be an integer");
timeout = parseInt(timeout, 10);
soakMin = parseInt(soakMin, 10);
if (soakMin > 0) timeout = soakMin * 60;

// ---- platform -------------------------------------------------------------

// Platform differences live here: where the mass-storage volume appears, how
// the USB-CDC serial device is named, and which tool sets the line settings.
// MICROBIT_VOLUME / MICROBIT_SERIAL override the discovery.
const platform = process.platform;
const isWindows = platform === "win32";

const WIN_VOLUME_PS =
    "(Get-CimInstance Win32_LogicalDisk | " +
    "Where-Object {$_.VolumeName -eq 'MICROBIT'}).DeviceID";
const WIN_SERIAL_PS =
    "(Get-CimInstance Win32_SerialPort | " +
    "Where-Object {$_.Name -match 'mbed|DAPLink|USB Serial'}) | " +
    "ForEach-Object DeviceID";

let staticVolumes = null;   // fixed candidate list, or null when discovery is dynamic
let volumeDesc = "";        // what the "no volume" message says was looked at
let devDesc = "";           // what the serial messages call the device
let sttyFlag = "";

if (platform === "darwin") {
    staticVolumes = ["/Volumes/MICROBIT"];
    devDesc = "/dev/cu.usbmodem* device";
    sttyFlag = "-f";
} else if (platform === "linux") {
    const user = process.env.USER || "root";
    staticVolumes = ["/media/" + user + "/MICROBIT",
                     "/run/media/" + user + "/MICROBIT",
                     "/media/MICROBIT"];
    devDesc = "/dev/ttyACM* device";
    sttyFlag = "-F";
} else if (isWindows) {
    devDesc = "mbed/DAPLink/USB Serial COM port";
} else {
    fail("unsupported platform '" + platform +
        "' -- see the Platforms section of tests/hw-ab/README.md");
}

function powershellLines(script) {
    const res = spawnSync("powershell", ["-NoProfile", "-Command", script],
        { encoding: "utf8" });
    if (res.error || res.status !== 0) return [];
    return String(res.stdout || "").split(/\r?\n/)
        .map(s => s.trim()).filter(s => s.length > 0);
}

// "E:" from Windows tools names a drive plus its current directory; "E:\" is
// the root, which is what a path join and an existence test need.
function driveRoot(v) {
    return /^[A-Za-z]:$/.test(v) ? v + "\\" : v;
}

if (process.env.MICROBIT_VOLUME) {
    staticVolumes = [isWindows
        ? driveRoot(process.env.MICROBIT_VOLUME)
        : process.env.MICROBIT_VOLUME];
}
volumeDesc = staticVolumes
    ? staticVolumes.join(" ")
    : "the drive whose volume label is MICROBIT";

function volumeCandidates() {
    if (staticVolumes) return staticVolumes;
    return powershellLines(WIN_VOLUME_PS).map(driveRoot);
}

function isDir(p) {
    try { return fs.statSync(p).isDirectory(); } catch (e) { return false; }
}

function findVolume() {
    for (const v of volumeCandidates()) {
        if (isDir(v)) return v;
    }
    return null;
}

// ---- small helpers --------------------------------------------------------

function nowSeconds() {
    return Math.floor(Date.now() / 1000);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForVolume(seconds) {
    const deadline = nowSeconds() + seconds;
    while (nowSeconds() < deadline) {
        const v = findVolume();
        if (v) return v;
        await sleep(1000);
    }
    return null;
}

// The log is read back as latin1 so that undecodable serial noise survives a
// round trip and is reported byte for byte.
function readLog() {
    try { return fs.readFileSync(logFile, "latin1"); } catch (e) { return ""; }
}

function splitLines(text) {
    const lines = text.split("\n");
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    return lines;
}

function firstMatch(text, needle) {
    for (const line of splitLines(text)) {
        if (line.indexOf(needle) >= 0) return line;
    }
    return null;
}

function countMatches(text, needle) {
    let n = 0;
    for (const line of splitLines(text)) {
        if (line.indexOf(needle) >= 0) n++;
    }
    return n;
}

// Verdict lines are only meaningful from the flashed program's own START
// banner onward: the port can open onto buffered output from the previously
// flashed program (DAPLink keeps transmitting into its buffer while no host
// reads), and that output can contain a PASS banner. Returns null until the
// banner has been seen.
function startNeedle() {
    return "HWAB START" + (expectCase ? " " + expectCase : "");
}

function verdictBody(content) {
    const lines = splitLines(content);
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].indexOf(startNeedle()) >= 0)
            return lines.slice(i).join("\n");
    }
    return null;
}

function firstHwabLine(text) {
    return firstMatch(text, "HWAB ");
}

function countLines(text) {
    let n = 0;
    for (let i = 0; i < text.length; i++) if (text[i] === "\n") n++;
    return n;
}

// The trailing bytes of the last n lines, exactly as `tail -n <n>` emits them.
function tailBytes(text, n) {
    let i = text.length - 1;
    if (i >= 0 && text[i] === "\n") i--;
    let count = 0;
    for (; i >= 0; i--) {
        if (text[i] === "\n") {
            count++;
            if (count === n) return text.slice(i + 1);
        }
    }
    return text;
}

function writeRaw(stream, text) {
    stream.write(Buffer.from(text, "latin1"));
}

// ---- capture --------------------------------------------------------------

let devFd = null;
let logFd = null;
let pumpTimer = null;
let stopped = false;
let volumePath = null;      // volume the current attempt flashed through

// DAPLink writes FAIL.TXT to the volume when it rejects an incoming hex (a
// decode failure surfaces as panic 521), and the program then never runs.
// Returns the file's text, or null when there is none or the volume has gone.
function readFailTxt() {
    if (!volumePath) return null;
    let name = null;
    try {
        for (const entry of fs.readdirSync(volumePath)) {
            if (/^fail\.txt$/i.test(entry)) { name = entry; break; }
        }
    } catch (e) {
        return null;   // unmounted, or not readable
    }
    if (!name) return null;
    try {
        return fs.readFileSync(path.join(volumePath, name), "latin1");
    } catch (e) {
        return null;
    }
}

function cleanup() {
    stopped = true;
    if (pumpTimer !== null) { clearInterval(pumpTimer); pumpTimer = null; }
    if (logFd !== null) { try { fs.closeSync(logFd); } catch (e) { /* closed */ } logFd = null; }
    if (devFd !== null) { try { fs.closeSync(devFd); } catch (e) { /* closed */ } devFd = null; }
}

const READ_BUF = Buffer.allocUnsafe(4096);

// Drains whatever the device has buffered into the log, so that a poll of the
// log file sees bytes as they arrive. The read must not block: an outstanding
// blocking read holds a worker thread that node waits for on the way out, which
// would leave the script hanging past its own verdict. On POSIX the fd carries
// O_NONBLOCK and a quiet port raises EAGAIN; on Windows the mode-configured
// handle returns what it has rather than waiting for a full buffer.
function pump() {
    while (!stopped && devFd !== null && logFd !== null) {
        let bytes;
        try {
            bytes = fs.readSync(devFd, READ_BUF, 0, READ_BUF.length, null);
        } catch (e) {
            return;   // EAGAIN while the port is quiet, or the device went away
        }
        if (bytes <= 0) return;
        try { fs.writeSync(logFd, READ_BUF, 0, bytes); } catch (e) { return; }
    }
}

function startReader() {
    // Frequently enough that a burst at 115200 baud cannot outrun the tty's own
    // input buffer between polls. Clearing `stopped` is what lets a second
    // attempt read after the first one's cleanup.
    stopped = false;
    pumpTimer = setInterval(pump, 50);
}

// One full flash-and-capture cycle: copy the hex, wait for the board to come
// back, open its serial device and read until a verdict or the timeout. Returns
// the outcome for report(). Host and board problems still exit through fail()
// here -- a second attempt at a missing board finds the same missing board.
async function attempt() {
    volumePath = await waitForVolume(VOLUME_WAIT);
    if (!volumePath) {
        process.stderr.write(
            "run-capture: no MICROBIT volume within " + VOLUME_WAIT + "s (looked at:\n" +
            volumeDesc + ").\n" +
            "\n" +
            "Plug a micro:bit into USB and wait for the MICROBIT drive to mount. If the\n" +
            "board is plugged in and the drive is absent, the cable may be charge-only, or\n" +
            "the board may be in a bad state -- unplug it, hold the reset button while\n" +
            "plugging it back in, and look for a MAINTENANCE drive (that means DAPLink is\n" +
            "in bootloader mode and needs its firmware reflashed). If the drive is mounted\n" +
            "somewhere this script did not look, point it there with MICROBIT_VOLUME.\n");
        process.exit(3);
    }

    process.stdout.write("run-capture: flashing " + hex + " -> " + volumePath + "\n");
    try {
        fs.copyFileSync(hex, path.join(volumePath, path.basename(hex)));
    } catch (e) {
        fail("copy to " + volumePath + " failed");
    }
    if (!isWindows) {
        // Best effort: push the copy out of the page cache before the drive
        // goes away. Windows has no equivalent that is worth spawning.
        spawnSync("sync", [], { stdio: "ignore" });
    }

    // DAPLink unmounts the drive while it programs, then remounts and resets the
    // board. Wait for the drive to go away (best effort -- flashing a small hex
    // can be quicker than this poll) and then for it to come back.
    const graceDeadline = nowSeconds() + UNMOUNT_GRACE;
    while (nowSeconds() < graceDeadline && isDir(volumePath)) await sleep(1000);
    if (!await waitForVolume(REMOUNT_WAIT))
        fail(volumePath + " did not remount within " + REMOUNT_WAIT + "s after flashing");
    process.stdout.write("run-capture: flashed, board remounted\n");

    // The generated programs idle for ~10s before printing, which is the window
    // this discovery and the line-settings setup have to fit into.
    let devs;
    if (process.env.MICROBIT_SERIAL) {
        devs = [process.env.MICROBIT_SERIAL];
        // A COM port is not a filesystem entry, so it can only be checked by
        // opening it, which happens below.
        if (!isWindows && !fs.existsSync(devs[0]))
            fail("MICROBIT_SERIAL=" + process.env.MICROBIT_SERIAL + " does not exist");
    } else if (isWindows) {
        devs = powershellLines(WIN_SERIAL_PS);
    } else {
        const prefix = platform === "darwin" ? "cu.usbmodem" : "ttyACM";
        let entries = [];
        try { entries = fs.readdirSync("/dev"); } catch (e) { entries = []; }
        devs = entries.filter(e => e.indexOf(prefix) === 0).sort()
            .map(e => "/dev/" + e);
    }

    if (devs.length === 0) {
        process.stderr.write(
            "run-capture: no " + devDesc + " found.\n" +
            "\n" +
            "The MICROBIT drive mounted, so DAPLink's mass storage is up but its serial\n" +
            "port is not. Unplug and replug the board; if that does not help the DAPLink\n" +
            "interface firmware is likely out of date and needs updating. On Linux, also\n" +
            "check that your user may open serial devices (typically the dialout group).\n");
        process.exit(3);
    }
    if (devs.length > 1) {
        process.stderr.write("run-capture: more than one " + devDesc + ":\n");
        for (const d of devs) process.stderr.write("  " + d + "\n");
        process.stderr.write(
            "\n" +
            "Only one board may be attached, otherwise the capture could read the wrong one.\n" +
            "Unplug the other USB serial devices and rerun, or name the right device with\n" +
            "MICROBIT_SERIAL.\n");
        process.exit(3);
    }

    const dev = devs[0];
    process.stdout.write("run-capture: serial " + dev + "\n");

    if (isWindows) {
        // Windows keeps the port configuration with the port, so `mode` is
        // applied before the handle is opened. The \\.\ prefix is required for
        // COM10 and above and harmless below it.
        const port = dev.replace(/^\\\\\.\\/, "");
        const cmd = "mode " + port +
            ": BAUD=115200 PARITY=n DATA=8 STOP=1 to=off xon=off dtr=on rts=on";
        const res = spawnSync(cmd, { shell: true, stdio: "ignore" });
        if (res.error || res.status !== 0)
            fail("mode failed on " + dev + " (is another program holding the port?)");
        try {
            devFd = fs.openSync("\\\\.\\" + port, "r");
        } catch (e) {
            devFd = null;
            fail("cannot open " + dev);
        }
    } else {
        // Hold the device open for the whole capture. Terminal settings reset
        // when the last open of a tty closes, and stty performs its own
        // open/close -- so without this held fd the 115200/raw settings would be
        // gone by the time the reader opens the port, and it would read garbage
        // at the default rate. The fd is opened first so the settings apply to
        // the held-open port, and every byte is read from this same fd.
        try {
            devFd = fs.openSync(dev, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
        } catch (e) {
            devFd = null;
            fail("cannot open " + dev);
        }
        const res = spawnSync("stty", [sttyFlag, dev, "115200", "raw", "-echo"],
            { stdio: "ignore" });
        if (res.error || res.status !== 0)
            fail("stty failed on " + dev + " (is another program holding the port?)");
    }

    fs.mkdirSync(path.dirname(path.resolve(logFile)), { recursive: true });
    logFd = fs.openSync(logFile, "w");
    startReader();

    const deadline = nowSeconds() + timeout;

    if (soakMin > 0) {
        process.stdout.write(
            "run-capture: soak for " + soakMin + " minute(s) -> " + logFile + "\n");
        // Snapshot the SOAK line count 60s before the end; if it has not grown
        // by the deadline the program stopped printing, which is how a leak ends.
        let checkpoint = deadline - 60;
        if (checkpoint <= nowSeconds()) checkpoint = deadline - Math.floor(timeout / 4);
        // The program's banner appears within seconds of the startup delay. A
        // soak that has printed nothing by this grace deadline never started
        // (a failed flash), which must not consume the whole soak window --
        // returning a no-banner timeout here hands it to the re-flash retry.
        const bannerGrace = nowSeconds() + 90;
        let sawBanner = false;
        let before = null;
        while (nowSeconds() < deadline) {
            if (!sawBanner) {
                sawBanner = verdictBody(readLog()) !== null;
                if (!sawBanner && nowSeconds() >= bannerGrace) {
                    cleanup();
                    const content = readLog();
                    return { kind: "timeout", content: content, noBanner: true };
                }
            }
            if (before === null && nowSeconds() >= checkpoint)
                before = countMatches(verdictBody(readLog()) || "", "HWAB SOAK");
            await sleep(5000);
        }
        cleanup();
        const content = verdictBody(readLog()) || "";
        return {
            kind: "soak",
            before: before === null ? 0 : before,
            after: countMatches(content, "HWAB SOAK"),
            content: content
        };
    }

    process.stdout.write(
        "run-capture: capturing up to " + timeout + "s -> " + logFile + "\n");
    const passNeedle = "HWAB PASS" + (expectCase ? " " + expectCase : "");
    while (nowSeconds() < deadline) {
        const body = verdictBody(readLog());
        if (body !== null) {
            const assertLine = firstMatch(body, "ASSERT ");
            if (assertLine !== null) {
                cleanup();
                return { kind: "assert", line: assertLine };
            }
            const passLine = firstMatch(body, passNeedle);
            if (passLine !== null) {
                cleanup();
                return { kind: "pass", line: passLine };
            }
        }
        await sleep(1000);
    }

    cleanup();
    const timedOut = readLog();
    return {
        kind: "timeout",
        content: timedOut,
        noBanner: verdictBody(timedOut) === null
    };
}

function reportSoak(result) {
    const content = result.content;
    process.stdout.write("run-capture: HWAB SOAK lines: " + result.before +
        " at checkpoint, " + result.after + " at end\n");
    const assertLine = firstMatch(content, "ASSERT ");
    if (assertLine !== null) {
        process.stderr.write("run-capture: FAIL -- assertion during soak:\n");
        writeRaw(process.stderr, assertLine + "\n");
        process.exit(1);
    }
    if (result.after > result.before) {
        process.stdout.write(
            "run-capture: PASS -- still printing after " + soakMin + " minute(s)\n");
        writeRaw(process.stdout, tailBytes(content, 1));
        process.exit(0);
    }
    process.stderr.write(
        "run-capture: FAIL -- output stalled before the end of the soak.\n" +
        "The board stopped printing HWAB SOAK lines, which is what an out-of-memory\n" +
        "panic looks like from the host side (the LED matrix will show a sad face and a\n" +
        "number; 020/021 are the memory panics). Last captured lines:\n");
    writeRaw(process.stderr, tailBytes(content, 5));
    process.exit(1);
}

// Turns an attempt's outcome into the script's output and exit code.
function report(result) {
    if (result.kind === "soak") reportSoak(result);
    if (result.kind === "assert") {
        process.stderr.write("run-capture: FAIL -- assertion failed on device:\n");
        writeRaw(process.stderr, result.line + "\n");
        process.stderr.write("run-capture: the board shows a sad face and 45.\n");
        process.exit(1);
    }
    if (result.kind === "pass") {
        writeRaw(process.stdout,
            "run-capture: PASS -- " + result.line.replace(/\r/g, "") + "\n");
        process.exit(0);
    }

    const content = result.content;
    const logLines = countLines(content);
    const logBytes = content.length;
    process.stderr.write(
        "run-capture: TIMEOUT -- no HWAB PASS and no ASSERT within " + timeout + "s.\n" +
        "Captured " + logLines + " line(s), " + logBytes + " byte(s). Last lines:\n");
    writeRaw(process.stderr, tailBytes(content, 5));
    if (result.noBanner) {
        process.stderr.write(
            "\nNo \"" + startNeedle() + "\" banner was seen, so no verdict could be read.\n");
        const failText = readFailTxt();
        if (failText !== null) {
            process.stderr.write(
                "DAPLink left FAIL.TXT on " + volumePath + ": it rejected the hex, so the\n" +
                "program never ran.\n");
            writeRaw(process.stderr, failText.replace(/[\r\n]+$/, "") + "\n");
        }
        const stray = firstHwabLine(content);
        if (stray !== null) {
            process.stderr.write(
                "HWAB output from another program was ignored (stale serial buffer from\n" +
                "the previously flashed program, or the flash did not take). First\n" +
                "ignored line:\n");
            writeRaw(process.stderr, stray + "\n");
        }
    }
    if (logLines === 0 && logBytes > 0) {
        process.stderr.write(
            "\n" +
            "Bytes arrived but formed no complete line -- usually undecodable garbage from\n" +
            "wrong serial line settings (baud or framing). Check that nothing else has the\n" +
            "port open and reconfigures it, and that the device really is the micro:bit.\n");
    }
    process.stderr.write(
        "\n" +
        "If the log is empty the capture attached after the program had already run, or\n" +
        "the board reset. If the board shows a sad face the program panicked before\n" +
        "reaching its verdict; read the number off the matrix (999 = unhandled throw,\n" +
        "020/021 = out of memory).\n");
    process.exit(2);
}

async function main() {
    let result = await attempt();
    // A timeout with no banner means the program never spoke, and the usual
    // cause is a rejected flash (DAPLink error 521), which is intermittent and
    // clears on a re-flash. A timeout after a banner is a real verdict about a
    // program that did run, so it is reported as it stands.
    if (result.kind === "timeout" && result.noBanner) {
        process.stderr.write("run-capture: no banner -- re-flashing once\n");
        result = await attempt();
    }
    report(result);
}

process.on("exit", cleanup);

main().catch(err => {
    cleanup();
    fail(err && err.message ? err.message : String(err));
});
