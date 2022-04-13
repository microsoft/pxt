const INDENT = 4;

interface Line {
    text: string,
    index: number,
    indent: number
}

function getIndent(s: string): number {
    if (!s) return 0;
    return s.match(/^ */)[0].length || 0;
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
    return fixIndentationInRange(model, range);
}

export function fixIndentationInRange(model: monaco.editor.IReadOnlyModel, range: monaco.Range, insertText?: string): monaco.editor.ISingleEditOperation[] {
    const source = model.getValue();

    // TODO indentation for paste blocks
    const lineStart = model.getOffsetAt({ lineNumber: range.startLineNumber, column: 0 });
    const rangeStart =  model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn });
    const rangeEnd =  model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });

    let lines: string[];

    if (insertText) {
        lines = (source.slice(lineStart, rangeStart) + insertText).split('\n');
    }
    else {
        lines = source.slice(lineStart, rangeEnd).split('\n');
    }

    const startsWithinLine = lineStart !== rangeStart && !!source.substring(lineStart, rangeStart).trim()

    const codeLines = lines.map((s, i) => !!s ? i : -1).filter(i => i >= 0);

    let line = range.startLineNumber - 1;
    let prev = getLine(source, model, line);
    while (!prev && line > 0) {
        line = line - 1;
        prev = getLine(source, model, line);
    }
    let baseIndent = getIndent(prev);
    if (isCodeBlock(prev)) {
        baseIndent += INDENT;
    }

    lines[0] = startsWithinLine ? lines[0] : setIndent(baseIndent, lines[0]);

    for (let i = 1; i < codeLines.length; i++) {
        let currIndex = codeLines[i];
        let curr = lines[currIndex];

        let currentIndent = getIndent(curr);
        lines[currIndex] = setIndent(baseIndent + currentIndent, curr);
    }

    return [{
        text: lines.join('\n'),
        range: range.setStartPosition(range.startLineNumber, 0)
    }];
}