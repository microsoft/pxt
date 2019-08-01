const INDENT = 4;

interface Line {
    text: string,
    index: number,
    indent: number
}

function getIndent(s: string): number {
    if (!s) return 0;
    return s.match(/^\s*/)[0].length || 0;
}

function setIndent(i: number, s: string): string {
    return new Array(i + 1).join(' ') + s.trim();
}

function getLine(source: string, model: monaco.editor.IReadOnlyModel, lineNumber: number): string {
    return source.slice(model.getOffsetAt({ lineNumber: lineNumber, column: 0}),
                        model.getOffsetAt({ lineNumber: lineNumber + 1, column: 0}) );
}

// checks to see if the line ends in a colon, indicating the start of a code block
function isCodeBlock(s: string): boolean {
    s = s.trim();
    return s[s.length - 1] == ':';
}

export function provideDocumentRangeFormattingEdits(model: monaco.editor.IReadOnlyModel, range: monaco.Range, options: monaco.languages.FormattingOptions, token: monaco.CancellationToken): monaco.editor.ISingleEditOperation[] {
    const source = model.getValue();

    // TODO indentation for paste blocks
    const partial = range.startLineNumber != 0;
    const s =  model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn });
    const e =  model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });
    const lines = source.slice(s, e).split('\n');
    const codeLines = lines.map((s, i) => !!s ? i : -1).filter(i => i >= 0);

    let prev;
    if (partial) {
        prev = getLine(source, model, range.startLineNumber - 1);
    }

    for (let i = 0; i < codeLines.length; i++) {
        let currIndex = codeLines[i];
        let curr = lines[currIndex];
        let next = lines[codeLines[i + 1]];

        if (prev) {
            let prevIndent = getIndent(prev);
            let nextIndent = getIndent(next);

            // TODO additional heuristics based on position of next line?
            if (isCodeBlock(prev)) {
                // at the start of a code block, add one additional indent
                let indent = prevIndent + INDENT;
                lines[currIndex] = setIndent(indent, curr);
            } else if (next && prevIndent == nextIndent && prevIndent != getIndent(curr)  && !isCodeBlock(curr)) {
                // if previous and next line have same indent, adjust current to match
                lines[currIndex] = setIndent(prevIndent, curr);
            }
        }

        prev = lines[currIndex];
    }

    return [{
        text: lines.join('\n'),
        range: range
    }];
}