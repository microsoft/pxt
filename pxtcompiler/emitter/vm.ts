namespace ts.pxtc.vm {
    const emitErr = assembler.emitErr
    const badNameError = emitErr("opcode name doesn't match", "<name>")

    export class VmInstruction extends assembler.Instruction {
        constructor(ei: assembler.AbstractProcessor, format: string, opcode: number) {
            super(ei, format, opcode, opcode, false)
        }

        emit(ln: assembler.Line): assembler.EmitResult {
            let tokens = ln.words;
            if (tokens[0] != this.name) return badNameError;
            let opcode = this.opcode
            let j = 1;
            let stack = 0;
            let numArgs: number[] = []
            let labelName: string = null
            let opcode2: number = null
            let i2: number = null

            for (let i = 0; i < this.args.length; ++i) {
                let formal = this.args[i]
                let actual = tokens[j++]
                if (formal[0] == "$") {
                    let enc = this.ei.encoders[formal]
                    let v: number = null
                    if (enc.isImmediate || enc.isLabel) {
                        if (!actual)
                            return emitErr("expecting number", actual)
                        actual = actual.replace(/^#/, "")
                        v = ln.bin.parseOneInt(actual);
                        if (v == null)
                            return emitErr("expecting number", actual)
                    } else {
                        oops()
                    }
                    if (v == null) return emitErr("didn't understand it", actual);

                    U.assert(v >= 0)

                    if (v != 11111 && formal == "$lbl") {
                        v -= ln.bin.location() + 2
                        v >>= 1
                    }

                    numArgs.push(v)

                    v = enc.encode(v)
                    if (v == null) return emitErr("argument out of range or mis-aligned", actual);

                    if (formal == "$i3") {
                        v = i2 | (v << 6)
                    } else if (formal == "$i5") {
                        v = i2 | (v << 8)
                    }

                    if (formal == "$i2" || formal == "$i4") {
                        i2 = v
                    } else if (formal == "$rt") {
                        if (v != 11111 && v > 0x1000) {
                            U.oops("label: " + actual + " v=" + v)
                        }
                        opcode = v | 0x8000
                        if (this.name == "callrt.p")
                            opcode |= 0x2000
                    } else if (ln.isLong || v < 0 || v > 255) {
                        // keep it long for the final pass; otherwise labels may shift
                        ln.isLong = true
                        if (formal == "$lbl")
                            v -= 1 // account for bigger encoding in relative addresses
                        opcode = ((v >> 9) & 0xffff) | 0xc000
                        opcode2 = (this.opcode + (v << 7)) & 0xffff
                    } else {
                        opcode = (this.opcode + (v << 7)) & 0xffff
                    }
                } else if (formal == actual) {
                    // skip
                } else {
                    return emitErr("expecting " + formal, actual)
                }
            }

            if (tokens[j]) return emitErr("trailing tokens", tokens[j])

            return {
                stack: stack,
                opcode,
                opcode2,
                numArgs: numArgs,
                labelName: ln.bin.normalizeExternalLabel(labelName)
            }
        }
    }

    export const withPush: pxt.Map<boolean> = {}

    export const opcodes = [
        "stloc     $i1",
        "ldloc     $i1",
        "stfld     $i4, $i5",
        "ldfld     $i4, $i5",
        "newobj    $i1",
        "ldcap     $i1",
        "stglb     $i1",
        "ldglb     $i1",
        "ldint     $i1",
        "ldintneg  $i1",
        "ldspecial $i1",
        "ldnumber  $i1",
        "ldlit     $i1",
        "checkinst $i1",
        "mapget",
        "mapset", // last one with .p variant
        "ret       $i2, $i3",
        "popmany   $i1",
        "pushmany  $i1",
        "callind   $i1",
        "callproc  $i1",
        "calliface $i2, $i3",
        "callget   $i1",
        "callset   $i1",
        "jmp       $lbl",
        "jmpnz     $lbl",
        "jmpz      $lbl",
        "try       $lbl",
        "push",
        "pop",
    ]

    export class VmProcessor extends pxtc.assembler.AbstractProcessor {

        constructor(target: CompileTarget) {
            super();

            this.addEnc("$i1", "#0-8388607", v => this.inrange(8388607, v, v))
            this.addEnc("$i2", "#0-31", v => this.inrange(31, v, v))
            this.addEnc("$i3", "#0-262143", v => this.inrange(262143, v, v))
            this.addEnc("$i4", "#0-255", v => this.inrange(255, v, v))
            this.addEnc("$i5", "#0-32767", v => this.inrange(32767, v, v))
            this.addEnc("$lbl", "LABEL", v => this.inminmax(-4194304, 4194303, v, v)).isLabel = true
            this.addEnc("$rt", "SHIM", v => this.inrange(8388607, v, v)).isLabel = true

            let opId = 1
            let hasPush = true
            for (let opcode of opcodes.concat(["callrt $rt"])) {
                let ins = new VmInstruction(this, opcode, opId)
                this.instructions[ins.name] = [ins];

                if (hasPush || ins.name == "callrt") {
                    withPush[ins.name] = true
                    ins = new VmInstruction(this, opcode.replace(/\w+/, f => f + ".p"), opId | (1 << 6))
                    this.instructions[ins.name] = [ins];
                }

                if (ins.name == "mapset.p")
                    hasPush = false

                opId++
            }
        }

        public testAssembler() {
        }

        public postProcessRelAddress(f: assembler.File, v: number): number {
            return v;
        }

        public postProcessAbsAddress(f: assembler.File, v: number): number {
            return v;
        }

        public getAddressFromLabel(f: assembler.File, i: assembler.Instruction, s: string, wordAligned = false): number {
            // lookup absolute, relative, dependeing
            let l = f.lookupLabel(s);
            if (l == null) return null;
            if (i.is32bit)
                // absolute address
                return l
            // relative address
            return l - (f.pc() + 2)
        }


        public toFnPtr(v: number, baseOff: number) {
            return v
        }

        public wordSize() {
            return 8
        }

        public peephole(ln: assembler.Line, lnNext: assembler.Line, lnNext2: assembler.Line) {
            let lnop = ln.getOp()
            let lnop2 = ""

            if (lnNext) {
                lnop2 = lnNext.getOp()
                let key = lnop + ";" + lnop2
                let pc = this.file.peepCounts
                pc[key] = (pc[key] || 0) + 1
            }

            if (lnop == "stloc" && lnop2 == "ldloc" && ln.numArgs[0] == lnNext.numArgs[0]) {
                if (/LAST/.test(lnNext.text))
                    ln.update("")
                lnNext.update("")
            } else if (withPush[lnop] && lnop2 == "push") {
                ln.update(ln.text.replace(/\w+/, f => f + ".p"))
                lnNext.update("")
            }

            /*
            if (lnop == "jmp" && ln.numArgs[0] == this.file.baseOffset + lnNext.location) {
                // RULE: jmp .somewhere; .somewhere: -> .somewhere:
                ln.update("")
            } else if (lnop == "push" && (
                lnop2 == "callproc" || lnop2 == "ldconst" ||
                lnop2 == "stringlit" || lnop2 == "ldtmp")) {
                ln.update("")
                lnNext.update("push_" + lnop2 + " " + lnNext.words[1])
            } else if (lnop == "push" && (lnop2 == "ldzero" || lnop2 == "ldone")) {
                ln.update("")
                lnNext.update("push_" + lnop2)
            } else if (lnop == "ldtmp" && (lnop2 == "incr" || lnop2 == "decr")) {
                ln.update("ldtmp_" + lnop2 + " " + ln.words[1])
                lnNext.update("")
            }
            */
        }
    }
}
