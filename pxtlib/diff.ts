namespace pxt.diff {
    const diffClasses: pxt.Map<string> = {
        "@": "diff-marker",
        " ": "diff-unchanged",
        "+": "diff-added",
        "-": "diff-removed",
    }

    export interface RenderOptions {
        hideMarker?: boolean;
        hideRemoved?: boolean;
    }

    export function render(diffLines: string[], options: RenderOptions = {}): HTMLElement {
        if (!diffLines) {
            return pxt.dom.el("div", null, pxtc.Util.lf("Too many differences to render diff."));
        }

        let lnA = 0, lnB = 0
        let lastMark = ""
        const tbody = pxt.dom.el("tbody");
        const diffEl = pxt.dom.el("table", { "class": "diffview" }, tbody);
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
                    pxt.dom.el("td", { class: "line-a", "data-content": lnA }),
                    pxt.dom.el("td", { class: "line-b", "data-content": lnB }),
                    isMarker
                        ? pxt.dom.el("td", { "colspan": 2, class: "change" }, pxt.dom.el("code", null, ln))
                        : pxt.dom.el("td", { class: "marker", "data-content": lastMark }),
                    isMarker && pxt.dom.el("td", { class: "change" }, currDiff)
                ])
            );
        })

        return diffEl;
    }

    function lineDiff(lineA: string, lineB: string): { a: HTMLElement, b: HTMLElement } {
        const df = pxt.github.diff(lineA.split("").join("\n"), lineB.split("").join("\n"), {
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