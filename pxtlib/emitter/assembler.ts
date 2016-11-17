// TODO: add a macro facility to make 8-bit assembly easier?

namespace ts.pxtc.assembler {

    export interface InlineError {
        scope: string;
        message: string;
        line: string;
        lineNo: number;
        coremsg: string;
        hints: string;
    }

    export interface EmitResult {
        stack: number;
        opcode: number;
        opcode2?: number;    // in case of a 32-bit instruction
        numArgs?: number[];
        error?: string;
        errorAt?: string;
        labelName?: string;
    }

    export function lf(fmt: string, ...args: any[]) {
        return fmt.replace(/{(\d+)}/g, (match, index) => args[+index]);
    }

    let badNameError = emitErr("opcode name doesn't match", "<name>")

    // An Instruction represents an instruction class with meta-variables
    // that should be substituted given an actually line (Line) of assembly
    // Thus, the Instruction helps us parse a sequence of tokens in a Line
    // as well as extract the relevant values to substitute for the meta-variables.
    // The Instruction also knows how to convert the particular instance into
    // machine code (EmitResult)
    export class Instruction {
        public name: string;
        public args: string[];
        public friendlyFmt: string;
        public code: string;
        private ei: AbstractProcessor;
        public is32bit: boolean;

        constructor(ei: AbstractProcessor, format: string, public opcode: number, public mask: number, public jsFormat: string) {
            assert((opcode & mask) == opcode)

            this.ei = ei;
            this.code = format.replace(/\s+/g, " ");

            this.friendlyFmt = format.replace(/\$\w+/g, m => {
                if (this.ei.encoders[m])
                    return this.ei.encoders[m].pretty
                return m
            })

            let words = tokenize(format)
            this.name = words[0]
            this.args = words.slice(1)
            // a bit of a hack here...
            this.is32bit = (jsFormat != undefined)
        }

        emit(ln: Line): EmitResult {
            let tokens = ln.words;
            if (tokens[0] != this.name) return badNameError;
            let r = this.opcode;
            let j = 1;
            let stack = 0;
            let numArgs: number[] = []
            let labelName: string = null
            let bit32_value: number = null
            let bit32_actual: string = null

            for (let i = 0; i < this.args.length; ++i) {
                let formal = this.args[i]
                let actual = tokens[j++]
                if (formal[0] == "$") {
                    let enc = this.ei.encoders[formal]
                    let v: number = null
                    if (enc.isRegister) {
                        v = this.ei.registerNo(actual);
                        if (v == null) return emitErr("expecting register name", actual)
                        if (this.ei.isPush(this.opcode)) // push
                            stack++;
                        else if (this.ei.isPop(this.opcode)) // pop
                            stack--;
                    } else if (enc.isImmediate) {
                        actual = actual.replace(/^#/, "")
                        v = ln.bin.parseOneInt(actual);
                        if (v == null) {
                            return emitErr("expecting number", actual)
                        } else {
                            // explicit manipulation of stack pointer (SP)
                            // ARM only
                            if (this.ei.isAddSP(this.opcode))
                                stack = -(v / this.ei.wordSize());
                            else if (this.ei.isSubSP(this.opcode))
                                stack = (v / this.ei.wordSize());
                        }
                    } else if (enc.isRegList) {
                        // register lists are ARM-specific - this code not used in AVR 
                        if (actual != "{") return emitErr("expecting {", actual);
                        v = 0;
                        while (tokens[j] != "}") {
                            actual = tokens[j++];
                            if (!actual)
                                return emitErr("expecting }", tokens[j - 2])
                            let no = this.ei.registerNo(actual);
                            if (no == null) return emitErr("expecting register name", actual)
                            if (v & (1 << no)) return emitErr("duplicate register name", actual)
                            v |= (1 << no);
                            if (this.ei.isPush(this.opcode)) // push
                                stack++;
                            else if (this.ei.isPop(this.opcode)) // pop
                                stack--;
                            if (tokens[j] == ",") j++;
                        }
                        actual = tokens[j++]; // skip close brace
                    } else if (enc.isLabel) {
                        actual = actual.replace(/^#/, "")
                        if (/^[+-]?\d+$/.test(actual)) {
                            v = parseInt(actual, 10)
                            labelName = "rel" + v
                        } else if (/^0x[0-9a-fA-F]+$/.test(actual) ) {
                            v = parseInt(actual, 16)
                            labelName = "abs" + v
                        } else {
                            labelName = actual
                            v = this.ei.getAddressFromLabel(ln.bin, this, actual, enc.isWordAligned)
                            if (v == null) {
                                if (ln.bin.finalEmit)
                                    return emitErr("unknown label", actual)
                                else
                                    // just need some value when we are 
                                    // doing some pass other than finalEmit
                                    v = 8; // needs to be divisible by 4 etc
                            }
                        }
                        if (this.ei.is32bit(this)) {
                            // console.log(actual + " " + v.toString())
                            bit32_value = v
                            bit32_actual = actual
                            continue
                        }
                    } else {
                        oops()
                    }
                    if (v == null) return emitErr("didn't understand it", actual); // shouldn't happen

                    numArgs.push(v)

                    v = enc.encode(v)

                    // console.log("enc(v) = ",v)
                    if (v == null) return emitErr("argument out of range or mis-aligned", actual);
                    assert((r & v) == 0)
                    r |= v;
                } else if (formal == actual) {
                    // skip
                } else {
                    return emitErr("expecting " + formal, actual)
                }
            }

            if (tokens[j]) return emitErr("trailing tokens", tokens[j])

            if (this.ei.is32bit(this)) {
                return this.ei.emit32(r, bit32_value, ln.bin.normalizeExternalLabel(bit32_actual));
            }

            return {
                stack: stack,
                opcode: r,
                numArgs: numArgs,
                labelName: ln.bin.normalizeExternalLabel(labelName)
            }
        }

        toString() {
            return this.friendlyFmt;
        }
    }

    // represents a line of assembly from a file
    export class Line {
        public type: string;
        public lineNo: number;
        public words: string[]; // the tokens in this line 
        public scope: string;
        public location: number;
        public instruction: Instruction;
        public numArgs: number[];

        constructor(public bin: File, public text: string) {
        }

        public getOpExt() {
            return this.instruction ? this.instruction.code : "";
        }

        public getOp() {
            return this.instruction ? this.instruction.name : "";
        }

        public update(s: string) {
            this.bin.peepOps++;

            s = s.replace(/^\s*/, "")
            if (!s)
                this.bin.peepDel++;
            if (s) s += "      ";
            s = "    " + s;
            this.text = s + "; WAS: " + this.text.trim();
            this.instruction = null;
            this.numArgs = null;
            this.words = tokenize(s) || [];
            if (this.words.length == 0)
                this.type = "empty";
        }
    }

    // File is the center of the action: parsing a file into a sequence of Lines
    // and also emitting the binary (buf)
    export class File {
        constructor(ei: AbstractProcessor) {
            this.currLine = new Line(this, "<start>");
            this.currLine.lineNo = 0;
            this.ei = ei;
            this.ei.file = this;
        }

        public baseOffset: number = 0;
        public finalEmit: boolean;
        public reallyFinalEmit: boolean;
        public checkStack = true;
        public inlineMode = false;
        public lookupExternalLabel: (name: string) => number;
        public normalizeExternalLabel = (n: string) => n;
        private ei: AbstractProcessor;
        private lines: Line[];
        private currLineNo: number = 0;
        private realCurrLineNo: number;
        private currLine: Line;
        private scope = "";
        private scopeId = 0;
        public errors: InlineError[] = [];
        public buf: number[];
        private labels: pxt.Map<number> = {};
        private userLabelsCache: pxt.Map<number>;
        private stackpointers: pxt.Map<number> = {};
        private stack = 0;
        public peepOps = 0;
        public peepDel = 0;
        private stats = "";
        public throwOnError = false;
        public disablePeepHole = false;
        public stackAtLabel: pxt.Map<number> = {};
        private prevLabel: string;

        private emitShort(op: number) {
            assert(0 <= op && op <= 0xffff);
            this.buf.push(op);
        }

        public location() {
            // store one short (2 bytes) per buf location
            return this.buf.length * 2;
        }

        public pc() {
            return this.location() + this.baseOffset;
        }

        // parsing of an "integer", well actually much more than 
        // just that
        public parseOneInt(s: string): number {
            if (!s)
                return null;

            if (s == "0") return 0;

            let mul = 1

            // recursive-descent parsing of multiplication
            if (s.indexOf("*") >= 0) {
                let m: RegExpExecArray = null;
                while (m = /^([^\*]*)\*(.*)$/.exec(s)) {
                    let tmp = this.parseOneInt(m[1])
                    if (tmp == null) return null;
                    mul *= tmp;
                    s = m[2]
                }
            }

            if (s[0] == "-") {
                mul *= -1;
                s = s.slice(1)
            } else if (s[0] == "+") {
                s = s.slice(1)
            }

            let v: number = null

            // allow or'ing of 1 to least-signficant bit
            if (U.endsWith(s, "|1")) {
                return this.parseOneInt(s.slice(0, s.length - 2)) | 1
            }
            // allow subtracting 1 too
            if (U.endsWith(s, "-1")) {
                return this.parseOneInt(s.slice(0, s.length - 2)) - 1
            }



            // handle hexadecimal and binary encodings
            if (s[0] == "0") {
                if (s[1] == "x" || s[1] == "X") {
                    let m = /^0x([a-f0-9]+)$/i.exec(s)
                    if (m) v = parseInt(m[1], 16)
                } else if (s[1] == "b" || s[1] == "B") {
                    let m = /^0b([01]+)$/i.exec(s)
                    if (m) v = parseInt(m[1], 2)
                }
            }

            // decimal encoding
            let m = /^(\d+)$/i.exec(s)
            if (m) v = parseInt(m[1], 10)

            // stack-specific processing

            // more special characters to handle
            if (s.indexOf("@") >= 0) {
                m = /^(\w+)@(-?\d+)$/.exec(s)
                if (m) {
                    if (mul != 1)
                        this.directiveError(lf("multiplication not supported with saved stacks"));
                    if (this.stackpointers.hasOwnProperty(m[1])) {
                        // console.log(m[1] + ": " + this.stack + " " + this.stackpointers[m[1]] + " " + m[2])
                        v = this.ei.wordSize() * this.ei.computeStackOffset(m[1], this.stack - this.stackpointers[m[1]] + parseInt(m[2]))
                        // console.log(v)
                    }
                    else
                        this.directiveError(lf("saved stack not found"))
                }

                m = /^(.*)@(hi|lo)$/.exec(s)
                if (m && this.looksLikeLabel(m[1])) {
                    v = this.lookupLabel(m[1], true)
                    if (v != null) {
                        v >>= 1;
                        if (0 <= v && v <= 0xffff) {
                            if (m[2] == "hi")
                                v = (v >> 8) & 0xff
                            else if (m[2] == "lo")
                                v = v & 0xff
                            else
                                oops()
                        } else {
                            this.directiveError(lf("@hi/lo out of range"))
                            v = null
                        }
                    }
                }
            }

            if (v == null && this.looksLikeLabel(s)) {
                v = this.lookupLabel(s, true);
                if (v != null) v += this.baseOffset
            }

            if (v == null || isNaN(v)) return null;

            return v * mul;
        }

        private looksLikeLabel(name: string) {
            if (/^(r\d|pc|sp|lr)$/i.test(name))
                return false
            return /^[\.a-zA-Z_][\.:\w+]*$/.test(name)
        }

        private scopedName(name: string) {
            if (name[0] == "." && this.scope)
                return this.scope + "$" + name;
            else return name;
        }


        public lookupLabel(name: string, direct = false) {
            let v: number = null;
            let scoped = this.scopedName(name)
            if (this.labels.hasOwnProperty(scoped)) {
                v = this.labels[scoped];
                v = this.ei.postProcessRelAddress(this,v)
            } else if (this.lookupExternalLabel) {
                v = this.lookupExternalLabel(name)
                if (v != null)  {
                    v = this.ei.postProcessAbsAddress(this,v)
                }
            }
            if (v == null && direct) {
                if (this.finalEmit)
                    this.directiveError(lf("unknown label: {0}", name));
                else
                    v = 42;
            }
            return v;
        }

        private align(n: number) {
            assert(n == 2 || n == 4 || n == 8 || n == 16)
            while (this.location() % n != 0)
                this.emitShort(0);
        }

        public pushError(msg: string, hints: string = "") {
            let err = <InlineError>{
                scope: this.scope,
                message: lf("  -> Line {2} ('{1}'), error: {0}\n{3}", msg, this.currLine.text, this.currLine.lineNo, hints),
                lineNo: this.currLine.lineNo,
                line: this.currLine.text,
                coremsg: msg,
                hints: hints
            }
            this.errors.push(err)
            if (this.throwOnError)
                throw new Error(err.message)
        }

        private directiveError(msg: string) {
            this.pushError(msg)
            // this.pushError(lf("directive error: {0}", msg))
        }

        private emitString(l: string) {
            function byteAt(s: string, i: number) { return (s.charCodeAt(i) || 0) & 0xff }

            let m = /^\s*([\w\.]+\s*:\s*)?.\w+\s+(".*")\s*$/.exec(l)
            let s: string;
            if (!m || null == (s = parseString(m[2]))) {
                this.directiveError(lf("expecting string"))
            } else {
                this.align(2);
                // s.length + 1 to NUL terminate
                for (let i = 0; i < s.length + 1; i += 2) {
                    this.emitShort((byteAt(s, i + 1) << 8) | byteAt(s, i))
                }
            }
        }

        private parseNumber(words: string[]): number {
            let v = this.parseOneInt(words.shift())
            if (v == null) return null;
            return v;
        }

        private parseNumbers(words: string[]) {
            words = words.slice(1)
            let nums: number[] = []
            while (true) {
                let n = this.parseNumber(words)
                if (n == null) {
                    this.directiveError(lf("cannot parse number at '{0}'", words[0]))
                    break;
                } else
                    nums.push(n)

                if (words[0] == ",") {
                    words.shift()
                    if (words[0] == null)
                        break;
                } else if (words[0] == null) {
                    break;
                } else {
                    this.directiveError(lf("expecting number, got '{0}'", words[0]))
                    break;
                }
            }
            return nums
        }

        private emitSpace(words: string[]) {
            let nums = this.parseNumbers(words);
            if (nums.length == 1)
                nums.push(0)
            if (nums.length != 2)
                this.directiveError(lf("expecting one or two numbers"))
            else if (nums[0] % 2 != 0)
                this.directiveError(lf("only even space supported"))
            else {
                let f = nums[1] & 0xff;
                f = f | (f << 8)
                for (let i = 0; i < nums[0]; i += 2)
                    this.emitShort(f)
            }
        }

        private emitBytes(words: string[]) {
            let nums = this.parseNumbers(words)
            if (nums.length % 2 != 0) {
                this.directiveError(".bytes needs an even number of arguments")
                nums.push(0)
            }
            for (let i = 0; i < nums.length; i += 2) {
                let n0 = nums[i]
                let n1 = nums[i + 1]
                if (0 <= n0 && n1 <= 0xff &&
                    0 <= n1 && n0 <= 0xff)
                    this.emitShort((n0 & 0xff) | ((n1 & 0xff) << 8))
                else
                    this.directiveError(lf("expecting uint8"))
            }
        }

        private emitHex(words: string[]) {
            words.slice(1).forEach(w => {
                if (w == ",") return
                // TODO: why 4 and not 2?
                if (w.length % 4 != 0)
                    this.directiveError(".hex needs an even number of bytes")
                else if (!/^[a-f0-9]+$/i.test(w))
                    this.directiveError(".hex needs a hex number")
                else
                    for (let i = 0; i < w.length; i += 4) {
                        let n = parseInt(w.slice(i, i + 4), 16)
                        n = ((n & 0xff) << 8) | ((n >> 8) & 0xff)
                        this.emitShort(n)
                    }
            })
        }

        private handleDirective(l: Line) {
            let words = l.words;

            let expectOne = () => {
                if (words.length != 2)
                    this.directiveError(lf("expecting one argument"));
            }

            let num0: number;

            switch (words[0]) {
                case ".ascii":
                case ".asciz":
                case ".string":
                    this.emitString(l.text);
                    break;
                case ".align":
                    expectOne();
                    num0 = this.parseOneInt(words[1]);
                    if (num0 != null) {
                        if (num0 == 0) return;
                        if (num0 <= 4) {
                            this.align(1 << num0);
                        } else {
                            this.directiveError(lf("expecting 1, 2, 3 or 4 (for 2, 4, 8, or 16 byte alignment)"))
                        }
                    } else this.directiveError(lf("expecting number"));
                    break;
                case ".balign":
                    expectOne();
                    num0 = this.parseOneInt(words[1]);
                    if (num0 != null) {
                        if (num0 == 1) return;
                        if (num0 == 2 || num0 == 4 || num0 == 8 || num0 == 16) {
                            this.align(num0);
                        } else {
                            this.directiveError(lf("expecting 2, 4, 8, or 16"))
                        }
                    } else this.directiveError(lf("expecting number"));
                    break;
                case ".byte":
                    this.emitBytes(words);
                    break;
                case ".hex":
                    this.emitHex(words);
                    break;
                case ".hword":
                case ".short":
                case ".2bytes":
                    this.parseNumbers(words).forEach(n => {
                        // we allow negative numbers
                        if (-0x8000 <= n && n <= 0xffff)
                            this.emitShort(n & 0xffff)
                        else
                            this.directiveError(lf("expecting int16"))
                    })
                    break;
                case ".word":
                case ".4bytes":
                    // TODO: a word is machine-dependent (16-bit for AVR, 32-bit for ARM)
                    this.parseNumbers(words).forEach(n => {
                        // we allow negative numbers
                        if (-0x80000000 <= n && n <= 0xffffffff) {
                            this.emitShort(n & 0xffff)
                            this.emitShort((n >> 16) & 0xffff)
                        } else {
                            this.directiveError(lf("expecting int32"))
                        }
                    })
                    break;

                case ".skip":
                case ".space":
                    this.emitSpace(words);
                    break;

                case ".startaddr":
                    if (this.location())
                        this.directiveError(lf(".startaddr can be only be specified at the beginning of the file"))
                    expectOne()
                    this.baseOffset = this.parseOneInt(words[1]);
                    break;

                // The usage for this is as follows:
                // push {...}
                // @stackmark locals   ; locals := sp
                // ... some push/pops ...
                // ldr r0, [pc, locals@3] ; load local number 3
                // ... some push/pops ...
                // @stackempty locals ; expect an empty stack here
                case "@stackmark":
                    expectOne();
                    this.stackpointers[words[1]] = this.stack;
                    break;

                case "@stackempty":
                    if (this.stackpointers[words[1]] == null)
                        this.directiveError(lf("no such saved stack"))
                    else if (this.stackpointers[words[1]] != this.stack)
                        this.directiveError(lf("stack mismatch"))
                    break;

                case "@scope":
                    this.scope = words[1] || "";
                    this.currLineNo = this.scope ? 0 : this.realCurrLineNo;
                    break;

                case "@nostackcheck":
                    this.checkStack = false
                    break

                case "@dummystack":
                    expectOne()
                    this.stack += this.parseOneInt(words[1]);
                    break

                case ".section":
                case ".global":
                    this.stackpointers = {};
                    this.stack = 0;
                    this.scope = "$S" + this.scopeId++
                    break;

                case ".file":
                case ".text":
                case ".cpu":
                case ".fpu":
                case ".eabi_attribute":
                case ".code":
                case ".thumb_func":
                case ".type":
                    break;

                case "@":
                    // @ sp needed
                    break;

                default:
                    if (/^\.cfi_/.test(words[0])) {
                        // ignore
                    } else {
                        this.directiveError(lf("unknown directive"))
                    }
                    break;
            }
        }

        private handleOneInstruction(ln: Line, instr: Instruction) {
            let op = instr.emit(ln);
            if (!op.error) {
                this.stack += op.stack;
                if (this.checkStack && this.stack < 0)
                    this.pushError(lf("stack underflow"))
                ln.location = this.location()
                this.emitShort(op.opcode);
                if (op.opcode2 != null)
                    this.emitShort(op.opcode2);
                ln.instruction = instr;
                ln.numArgs = op.numArgs;

                return true;
            }
            return false;
        }

        private handleInstruction(ln: Line) {
            if (ln.instruction) {
                if (this.handleOneInstruction(ln, ln.instruction))
                    return;
            }

            let getIns = (n: string) => this.ei.instructions.hasOwnProperty(n) ? this.ei.instructions[n] : [];

            if (!ln.instruction) {
                let ins = getIns(ln.words[0])
                for (let i = 0; i < ins.length; ++i) {
                    if (this.handleOneInstruction(ln, ins[i]))
                        return;
                }
            }

            let w0 = ln.words[0].toLowerCase().replace(/s$/, "").replace(/[^a-z]/g, "")

            let hints = ""
            let possibilities = getIns(w0).concat(getIns(w0 + "s"))
            if (possibilities.length > 0) {
                possibilities.forEach(i => {
                    let err = i.emit(ln);
                    hints += lf("   Maybe: {0} ({1} at '{2}')\n", i.toString(), err.error, err.errorAt)
                })
            }

            this.pushError(lf("assembly error"), hints);
        }

        private mkLine(tx: string) {
            let l = new Line(this, tx);
            l.scope = this.scope;
            l.lineNo = this.currLineNo;
            this.lines.push(l);
            return l;
        }

        private prepLines(text: string) {
            this.currLineNo = 0;
            this.realCurrLineNo = 0;
            this.lines = [];

            text.split(/\r?\n/).forEach(tx => {
                if (this.errors.length > 10)
                    return;

                this.currLineNo++;
                this.realCurrLineNo++;

                let l = this.mkLine(tx);
                let words = tokenize(l.text) || [];
                l.words = words;

                let w0 = words[0] || ""

                if (w0.charAt(w0.length - 1) == ":") {
                    let m = /^([\.\w]+):$/.exec(words[0])
                    if (m) {
                        l.type = "label";
                        l.text = m[1] + ":"
                        l.words = [m[1]]
                        if (words.length > 1) {
                            words.shift()
                            l = this.mkLine(tx.replace(/^[^:]*:/, ""))
                            l.words = words
                            w0 = words[0] || ""
                        } else {
                            return;
                        }
                    }
                }

                let c0 = w0.charAt(0)
                if (c0 == "." || c0 == "@") {
                    l.type = "directive";
                    if (l.words[0] == "@scope")
                        this.handleDirective(l);
                } else {
                    if (l.words.length == 0)
                        l.type = "empty";
                    else
                        l.type = "instruction";
                }
            })
        }

        private iterLines() {
            this.stack = 0;
            this.buf = [];
            this.scopeId = 0;

            this.lines.forEach(l => {
                if (this.errors.length > 10)
                    return;

                this.currLine = l;

                if (l.words.length == 0) return;

                if (l.type == "label") {
                    let lblname = this.scopedName(l.words[0])
                    this.prevLabel = lblname
                    if (this.finalEmit) {
                        let curr = this.labels[lblname]
                        if (curr == null)
                            oops()
                        assert(this.errors.length > 0 || curr == this.location())
                        if (this.reallyFinalEmit) {
                            this.stackAtLabel[lblname] = this.stack
                        }
                    } else {
                        if (this.labels.hasOwnProperty(lblname))
                            this.directiveError(lf("label redefinition"))
                        else if (this.inlineMode && /^_/.test(lblname))
                            this.directiveError(lf("labels starting with '_' are reserved for the compiler"))
                        else {
                            this.labels[lblname] = this.location();
                        }
                    }
                } else if (l.type == "directive") {
                    this.handleDirective(l);
                } else if (l.type == "instruction") {
                    this.handleInstruction(l);
                } else if (l.type == "empty") {
                    // nothing
                } else {
                    oops()
                }

            })
        }


        public getSource(clean: boolean) {
            let lenTotal = this.buf ? this.buf.length * 2 : 0
            let lenThumb = this.labels["_program_end"] || lenTotal;
            let res =
                // ARM-specific
                lf("; thumb size: {0} bytes; src size {1} bytes\n", lenThumb, lenTotal - lenThumb) +
                lf("; assembly: {0} lines\n", this.lines.length) +
                this.stats + "\n\n"

            let pastEnd = false;

            this.lines.forEach((ln, i) => {
                if (pastEnd) return;
                if (ln.type == "label" && ln.words[0] == "_program_end")
                    pastEnd = true;
                let text = ln.text
                if (clean) {
                    if (ln.words[0] == "@stackempty" &&
                        this.lines[i - 1].text == ln.text)
                        return;

                    text = text.replace(/; WAS: .*/, "")
                    if (!text.trim()) return;
                }
                res += text + "\n"
            })

            return res;
        }

        private peepHole() {
            // TODO add: str X; ldr X -> str X ?
            let mylines = this.lines.filter(l => l.type != "empty")

            for (let i = 0; i < mylines.length; ++i) {
                let ln = mylines[i];
                if (/^user/.test(ln.scope)) // skip opt for user-supplied assembly
                    continue;
                let lnNext = mylines[i + 1];
                if (!lnNext) continue;
                let lnNext2 = mylines[i + 2]
                if (ln.type == "instruction") {
                    this.ei.peephole(ln, lnNext, lnNext2)
                }
            }
        }

        private peepPass(reallyFinal: boolean) {
            if (this.disablePeepHole)
                return;

            this.peepOps = 0;
            this.peepDel = 0;
            this.peepHole();

            this.throwOnError = true;
            this.finalEmit = false;
            this.labels = {};
            this.iterLines();
            assert(!this.checkStack || this.stack == 0);
            this.finalEmit = true;
            this.reallyFinalEmit = reallyFinal || this.peepOps == 0;
            this.iterLines();

            this.stats += lf("; peep hole pass: {0} instructions removed and {1} updated\n", this.peepDel, this.peepOps - this.peepDel)
        }

        public getLabels() {
            if (!this.userLabelsCache)
                this.userLabelsCache = U.mapMap(this.labels, (k, v) => v + this.baseOffset)
            return this.userLabelsCache
        }

        public emit(text: string) {

            assert(this.buf == null);

            this.prepLines(text);

            if (this.errors.length > 0)
                return;

            this.labels = {};
            this.iterLines();

            if (this.checkStack && this.stack != 0)
                this.directiveError(lf("stack misaligned at the end of the file"))

            if (this.errors.length > 0)
                return;

            this.finalEmit = true;
            this.reallyFinalEmit = this.disablePeepHole;
            this.iterLines();

            if (this.errors.length > 0)
                return;

            let maxPasses = 5
            for (let i = 0; i < maxPasses; ++i) {
                this.peepPass(i == maxPasses);
                if (this.peepOps == 0) break;
            }
        }
    }

    // describes the encodings of various parts of an instruction
    // (registers, immediates, register lists, labels)
    export interface Encoder {
        name: string;
        pretty: string;
        // given a value, check it is the right number of bits and 
        // translate the value to the proper set of bits
        encode: (v: number) => number;
        isRegister: boolean;
        isImmediate: boolean;
        isRegList: boolean;
        isLabel: boolean;
        isWordAligned?: boolean;
    }

    // an assembler provider must inherit from this
    // class and provide Encoders and Instructions
    export abstract class AbstractProcessor {

        public encoders: pxt.Map<Encoder>;
        public instructions: pxt.Map<Instruction[]>;
        public file: File = null;

        constructor() {
            this.encoders = {};
            this.instructions = {}
        }

        public wordSize() {
            return -1;
        }

        public computeStackOffset(kind: string, offset: number) {
            return offset;
        }

        public is32bit(i: Instruction) {
            return false;
        }

        public emit32(v1: number, v2: number, actual: string): EmitResult {
            return null;
        }

        public postProcessRelAddress(f: File, v: number): number {
            return v;
        }

        public postProcessAbsAddress(f: File, v: number): number {
            return v;
        }

        public peephole(ln: Line, lnNext: Line, lnNext2: Line) {
            return;
        }

        public registerNo(actual: string): number {
            return null;
        }

        public getAddressFromLabel(f: File, i: Instruction, s: string, wordAligned = false): number {
            return null;
        }

        public isPop(opcode: number): boolean {
            return false;
        }

        public isPush(opcode: number): boolean {
            return false;
        }

        public isAddSP(opcode: number): boolean {
            return false;
        }

        public isSubSP(opcode: number): boolean {
            return false;
        }

        public testAssembler() {
            assert(false)
        }

        protected addEnc = (n: string, p: string, e: (v: number) => number) => {
            let ee: Encoder = {
                name: n,
                pretty: p,
                encode: e,
                isRegister: /^\$r\d/.test(n),
                isImmediate: /^\$i\d/.test(n),
                isRegList: /^\$rl\d/.test(n),
                isLabel: /^\$l[a-z]/.test(n),
            }
            this.encoders[n] = ee
            return ee
        }

        protected inrange = (max: number, v: number, e: number) => {
            if (Math.floor(v) != v) return null;
            if (v < 0) return null;
            if (v > max) return null;
            return e;
        }

        protected inminmax = (min: number, max: number, v: number, e: number) => {
            if (Math.floor(v) != v) return null;
            if (v < min) return null;
            if (v > max) return null;
            return e;
        }

        protected inseq = (seq: number[], v: number) => {
            let ind = seq.indexOf(v);
            if (ind < 0) return null
            return ind;
        }

        protected inrangeSigned = (max: number, v: number, e: number) => {
            if (Math.floor(v) != v) return null;
            if (v < -(max + 1)) return null;
            if (v > max) return null;
            let mask = (max << 1) | 1
            return e & mask;
        }


        protected addInst = (name: string, code: number, mask: number, jsFormat?: string) => {
            let ins = new Instruction(this, name, code, mask, jsFormat)
            if (!this.instructions.hasOwnProperty(ins.name))
                this.instructions[ins.name] = [];
            this.instructions[ins.name].push(ins)
        }
    }

    // utility functions
    function tokenize(line: string): string[] {
        let words: string[] = []
        let w = ""
        loop: for (let i = 0; i < line.length; ++i) {
            switch (line[i]) {
                case "[":
                case "]":
                case "!":
                case "{":
                case "}":
                case ",":
                    if (w) { words.push(w); w = "" }
                    words.push(line[i])
                    break;
                case " ":
                case "\t":
                case "\r":
                case "\n":
                    if (w) { words.push(w); w = "" }
                    break;
                case ";":
                    // drop the trailing comment
                    break loop;
                default:
                    w += line[i]
                    break;
            }
        }
        if (w) { words.push(w); w = "" }
        if (!words[0]) return null
        return words
    }

    function parseString(s: string) {
        s = s.replace(/\/\//g, "\\B")           // don't get confused by double backslash
            .replace(/\\(['\?])/g, (f, q) => q) // these are not valid in JSON yet valid in C
            .replace(/\\[z0]/g, "\u0000")      // \0 is valid in C 
            .replace(/\\x([0-9a-f][0-9a-f])/gi, (f, h) => "\\u00" + h)
            .replace(/\\B/g, "\\\\") // undo anti-confusion above
        try {
            return JSON.parse(s)
        } catch (e) {
            return null
        }
    }

    export function emitErr(msg: string, tok: string) {
        return {
            stack: <number>null,
            opcode: <number>null,
            error: msg,
            errorAt: tok
        }
    }

    function testOne(ei: AbstractProcessor, op: string, code: number) {
        let b = new File(ei)
        b.checkStack = false;
        b.emit(op)
        assert(b.buf[0] == code)
    }

    export function expectError(ei: AbstractProcessor, asm: string) {
        let b = new File(ei);
        b.emit(asm);
        if (b.errors.length == 0) {
            oops("ASMTEST: expecting error for: " + asm)
        }
        // console.log(b.errors[0].message)
    }

    export function tohex(n: number) {
        if (n < 0 || n > 0xffff)
            return ("0x" + n.toString(16)).toLowerCase()
        else
            return ("0x" + ("000" + n.toString(16)).slice(-4)).toLowerCase()
    }

    export function expect(ei: AbstractProcessor, disasm: string) {
        let exp: number[] = []
        let asm = disasm.replace(/^([0-9a-fA-F]{4,8})\s/gm, (w, n) => {
            exp.push(parseInt(n.slice(0,4), 16))
            if (n.length == 8)
                exp.push(parseInt(n.slice(4,8), 16))
            return ""
        })

        let b = new File(ei);
        b.throwOnError = true;
        b.disablePeepHole = true;
        b.emit(asm);
        if (b.errors.length > 0) {
            console.debug(b.errors[0].message)
            oops("ASMTEST: not expecting errors")
        }

        if (b.buf.length != exp.length)
            oops("ASMTEST: wrong buf len")
        for (let i = 0; i < exp.length; ++i) {
            if (b.buf[i] != exp[i])
                oops("ASMTEST: wrong buf content at " + i + " , exp:" + tohex(exp[i]) + ", got: " + tohex(b.buf[i]))
        }
    }
}