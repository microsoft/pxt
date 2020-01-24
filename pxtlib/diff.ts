namespace pxt.diff {
    /*
    Constant MAX ∈ [0,M+N]
    Var V: Array [− MAX .. MAX] of Integer
    V[1]←0
    For D←0 to MAX Do
        For k ← −D to D in steps of 2 Do 
            If k=−D or k≠D and V[k−1]<V[k+1] Then
                x ← V[k+1] 
            Else
                x ← V[k−1]+1 
            y←x−k
            While x<N and y<M and a[x+1] =b[y+1] Do 
                (x,y)←(x+1,y+1) 
            V[k]←x
            If x≥N and y≥M Then
                Length of an SES is D
                Stop
    */

    type UArray = Uint32Array | Uint16Array

    export function toLines(file: string) {
        return file ? file.split(/\r?\n/) : []
    }

    export interface DiffOptions {
        context?: number; // lines of context; defaults to 3
        ignoreWhitespace?: boolean;
        maxDiffSize?: number; // defaults to 1024
    }

    // based on An O(ND) Difference Algorithm and Its Variations by EUGENE W. MYERS
    export function compute(fileA: string, fileB: string, options: DiffOptions = {}): string[] {
        if (options.ignoreWhitespace) {
            fileA = fileA.replace(/[\r\n]+$/, "")
            fileB = fileB.replace(/[\r\n]+$/, "")
        }

        const a = toLines(fileA)
        const b = toLines(fileB)

        const MAX = Math.min(options.maxDiffSize || 1024, a.length + b.length)
        if (MAX == 0) // nothing to diff
            return [];
        const ctor = a.length > 0xfff0 ? Uint32Array : Uint16Array

        const idxmap: pxt.Map<number> = {}
        let curridx = 0
        const aidx = mkidx(a), bidx = mkidx(b)

        function mkidx(strings: string[]) {
            const idxarr = new ctor(strings.length)
            let i = 0
            for (let e of strings) {
                if (options.ignoreWhitespace)
                    e = e.replace(/\s+$/g, "").replace(/^\s+/g, ''); // only ignore start/end of lines
                if (idxmap.hasOwnProperty(e))
                    idxarr[i] = idxmap[e]
                else {
                    ++curridx
                    idxarr[i] = curridx
                    idxmap[e] = curridx
                }
                i++
            }
            return idxarr
        }

        const V = new ctor(2 * MAX + 1)
        let diffLen = -1
        for (let D = 0; D <= MAX; D++) {
            if (computeFor(D, V) != null) {
                diffLen = D
            }
        }

        if (diffLen == -1)
            return null // diffLen > MAX

        const trace: UArray[] = []
        let endpoint: number = null
        for (let D = 0; D <= diffLen; D++) {
            const V = trace.length ? trace[trace.length - 1].slice(0) : new ctor(2 * diffLen + 1)
            trace.push(V)
            endpoint = computeFor(D, V)
            if (endpoint != null)
                break
        }

        const diff: string[] = []
        let k = endpoint
        for (let D = trace.length - 1; D >= 0; D--) {
            const V = trace[D]
            let x = 0
            let nextK = 0
            if (k == -D || (k != D && V[MAX + k - 1] < V[MAX + k + 1])) {
                nextK = k + 1
                x = V[MAX + nextK]
            } else {
                nextK = k - 1
                x = V[MAX + nextK] + 1
            }
            let y = x - k
            const snakeLen = V[MAX + k] - x
            for (let i = snakeLen - 1; i >= 0; --i)
                diff.push("  " + a[x + i])

            if (nextK == k - 1) {
                diff.push("- " + a[x - 1])
            } else {
                if (y > 0)
                    diff.push("+ " + b[y - 1])
            }
            k = nextK
        }
        diff.reverse()

        if (options.context == Infinity)
            return diff

        let aline = 1, bline = 1, idx = 0
        const shortDiff: string[] = []
        const context = options.context || 3
        while (idx < diff.length) {
            let nextIdx = idx
            while (nextIdx < diff.length && diff[nextIdx][0] == " ")
                nextIdx++
            if (nextIdx == diff.length)
                break
            const startIdx = nextIdx - context
            const skip = startIdx - idx
            if (skip > 0) {
                aline += skip
                bline += skip
                idx = startIdx
            }
            const hdPos = shortDiff.length
            const aline0 = aline, bline0 = bline
            shortDiff.push("@@") // patched below

            let endIdx = idx
            let numCtx = 0
            while (endIdx < diff.length) {
                if (diff[endIdx][0] == " ") {
                    numCtx++
                    if (numCtx > context * 2 + 2) {
                        endIdx -= context + 2
                        break
                    }
                } else {
                    numCtx = 0
                }
                endIdx++
            }

            while (idx < endIdx) {
                shortDiff.push(diff[idx])
                const c = diff[idx][0]
                switch (c) {
                    case "-": aline++; break;
                    case "+": bline++; break;
                    case " ": aline++; bline++; break;
                }
                idx++
            }
            shortDiff[hdPos] = `@@ -${aline0},${aline - aline0} +${bline0},${bline - bline0} @@`
        }

        return shortDiff

        function computeFor(D: number, V: UArray) {
            for (let k = -D; k <= D; k += 2) {
                let x = 0
                if (k == -D || (k != D && V[MAX + k - 1] < V[MAX + k + 1]))
                    x = V[MAX + k + 1]
                else
                    x = V[MAX + k - 1] + 1
                let y = x - k
                while (x < aidx.length && y < bidx.length && aidx[x] == bidx[y]) {
                    x++
                    y++
                }
                V[MAX + k] = x
                if (x >= aidx.length && y >= bidx.length) {
                    return k
                }
            }
            return null
        }
    }

    // based on "A Formal Investigation of Diff3" by Sanjeev Khanna, Keshav Kunal, and Benjamin C. Pierce
    export function diff3(fileA: string, fileO: string, fileB: string,
        lblA: string, lblB: string) {
        const ma = computeMatch(fileA)
        const mb = computeMatch(fileB)

        if (!ma || !mb) // diff failed, can't merge
            return undefined;

        const fa = toLines(fileA)
        const fb = toLines(fileB)
        let numConflicts = 0

        let r: string[] = []
        let la = 0, lb = 0
        for (let i = 0; i < ma.length - 1;) {
            if (ma[i] == la && mb[i] == lb) {
                r.push(fa[la])
                la++
                lb++
                i++
            } else {
                let aSame = true
                let bSame = true
                let j = i
                while (j < ma.length) {
                    if (ma[j] != la + j - i)
                        aSame = false
                    if (mb[j] != lb + j - i)
                        bSame = false
                    if (ma[j] != null && mb[j] != null)
                        break
                    j++
                }
                U.assert(j < ma.length)
                if (aSame) {
                    while (lb < mb[j])
                        r.push(fb[lb++])
                } else if (bSame) {
                    while (la < ma[j])
                        r.push(fa[la++])
                } else if (fa.slice(la, ma[j]).join("\n") == fb.slice(lb, mb[j]).join("\n")) {
                    // false conflict - both are the same
                    while (la < ma[j])
                        r.push(fa[la++])
                } else {
                    numConflicts++
                    r.push("<<<<<<< " + lblA)
                    while (la < ma[j])
                        r.push(fa[la++])
                    r.push("=======")
                    while (lb < mb[j])
                        r.push(fb[lb++])
                    r.push(">>>>>>> " + lblB)
                }
                i = j
                la = ma[j]
                lb = mb[j]
            }
        }

        return { merged: r.join("\n"), numConflicts }

        function computeMatch(fileA: string) {
            const da = compute(fileO, fileA, { context: Infinity })
            if (!da)
                return undefined;
            const ma: number[] = []

            let aidx = 0
            let oidx = 0

            // console.log(da)
            for (let l of da) {
                if (l[0] == "+") {
                    aidx++
                } else if (l[0] == "-") {
                    ma[oidx] = null
                    oidx++
                } else if (l[0] == " ") {
                    ma[oidx] = aidx
                    aidx++
                    oidx++
                } else {
                    U.oops()
                }
            }

            ma.push(aidx + 1) // terminator

            return ma
        }
    }

    const diffClasses: pxt.Map<string> = {
        "@": "diff-marker",
        " ": "diff-unchanged",
        "+": "diff-added",
        "-": "diff-removed",
    }

    export interface RenderOptions extends DiffOptions {
        hideLineNumbers?: boolean;
        hideMarker?: boolean;
        hideRemoved?: boolean;
    }

    export function render(fileA: string, fileB: string, options: RenderOptions = {}): HTMLElement {
        const diffLines = compute(fileA, fileB, options);
        if (!diffLines) {
            return pxt.dom.el("div", null, pxtc.Util.lf("Too many differences to render diff."));
        }

        let lnA = 0, lnB = 0
        let lastMark = ""
        const tbody = pxt.dom.el("tbody");
        const diffEl = pxt.dom.el("table", { 
            "class": `diffview ${options.hideLineNumbers ? 'nonumbers' : ''}` 
        }, tbody);
        let savedDiffEl: HTMLElement = null
        diffLines.forEach((ln: string, idx: number) => {
            const m = /^@@ -(\d+),\d+ \+(\d+),\d+/.exec(ln)
            if (m) {
                lnA = parseInt(m[1]) - 1
                lnB = parseInt(m[2]) - 1
            } else {
                if (ln[0] != "+")
                    lnA++
                if (ln[0] != "-")
                    lnB++
            }
            const nextMark = diffLines[idx + 1] ? diffLines[idx + 1][0] : ""
            const next2Mark = diffLines[idx + 2] ? diffLines[idx + 2][0] : ""
            const lnSrc = ln.slice(2);
            let currDiff = pxt.dom.el("code", null, lnSrc)

            if (savedDiffEl) {
                currDiff = savedDiffEl
                savedDiffEl = null
            } else if (ln[0] == "-" && (lastMark == " " || lastMark == "@") && nextMark == "+"
                && (next2Mark == " " || next2Mark == "@" || next2Mark == "")) {
                const r = lineDiff(ln.slice(2), diffLines[idx + 1].slice(2))
                currDiff = r.a
                savedDiffEl = r.b
            }
            lastMark = ln[0];

            // check if line is skipped
            if ((options.hideMarker && lastMark == "@")
                || (options.hideRemoved && lastMark == "-"))
                return;

            // add diff
            const isMarker = lastMark == "@";
            const className = `${diffClasses[lastMark]}`;
            tbody.appendChild(
                pxt.dom.el("tr", { "class": className }, [
                    !options.hideLineNumbers && pxt.dom.el("td", { class: "line-a", "data-content": lnA }),
                    !options.hideLineNumbers && pxt.dom.el("td", { class: "line-b", "data-content": lnB }),
                    isMarker
                        ? pxt.dom.el("td", { "colspan": 2, class: "change" }, pxt.dom.el("code", null, ln))
                        : pxt.dom.el("td", { class: "marker", "data-content": lastMark }),
                    !isMarker && pxt.dom.el("td", { class: "change" }, currDiff)
                ])
            );
        })

        return diffEl;
    }

    function lineDiff(lineA: string, lineB: string): { a: HTMLElement, b: HTMLElement } {
        const df = compute(lineA.split("").join("\n"), lineB.split("").join("\n"), {
            context: Infinity
        })
        if (!df) // diff failed
            return {
                a: pxt.dom.el("div", { "class": "inline-diff" }, pxt.dom.el("code", null, lineA)),
                b: pxt.dom.el("div", { "class": "inline-diff" }, pxt.dom.el("code", null, lineB))
            }

        const ja: HTMLElement[] = []
        const jb: HTMLElement[] = []
        for (let i = 0; i < df.length;) {
            let j = i
            const mark = df[i][0]
            while (df[j] && df[j][0] == mark)
                j++
            const chunk = df.slice(i, j).map(s => s.slice(2)).join("")
            if (mark == " ") {
                ja.push(pxt.dom.el("code", { "class": "ch-common" }, chunk));
                jb.push(pxt.dom.el("code", { "class": "ch-common" }, chunk));
            } else if (mark == "-") {
                ja.push(pxt.dom.el("code", { "class": "ch-removed" }, chunk))
            } else if (mark == "+") {
                jb.push(pxt.dom.el("code", { "class": "ch-added" }, chunk))
            } else {
                pxt.Util.oops()
            }
            i = j
        }
        return {
            a: pxt.dom.el("div", { "class": "inline-diff" }, ja),
            b: pxt.dom.el("div", { "class": "inline-diff" }, jb)
        }
    }
}