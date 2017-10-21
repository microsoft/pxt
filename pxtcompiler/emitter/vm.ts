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
            let opcode = this.opcode;
            let j = 1;
            let stack = 0;
            let numArgs: number[] = []
            let labelName: string = null
            let opcode2: number = null
            let opcode3: number = null

            for (let i = 0; i < this.args.length; ++i) {
                let formal = this.args[i]
                let actual = tokens[j++]
                if (formal[0] == "$") {
                    let enc = this.ei.encoders[formal]
                    let v: number = null
                    if (enc.isImmediate) {
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

                    numArgs.push(v)

                    v = enc.encode(v)
                    if (v == null) return emitErr("argument out of range or mis-aligned", actual);

                    if (formal == "$i1") {
                        assert(0 <= v && v <= 255)
                        opcode2 = v
                    } else if (formal == "$i2") {
                        opcode2 = v & 0xff
                        opcode3 = (v >> 8) & 0xff
                    } else {
                        oops()
                    }
                } else if (formal == actual) {
                    // skip
                } else {
                    return emitErr("expecting " + formal, actual)
                }
            }

            if (tokens[j]) return emitErr("trailing tokens", tokens[j])

            if (this.name == "call") {
                opcode += numArgs[0]
            }

            return {
                stack: stack,
                opcode,
                opcode2,
                opcode3,
                numArgs: numArgs,
                labelName: ln.bin.normalizeExternalLabel(labelName)
            }
        }
    }

    export class VmProcessor extends pxtc.assembler.AbstractProcessor {

        constructor(target: CompileTarget) {
            super();

            this.addEnc("$i1", "#0-255", v => this.inrange(255, v, v))
            this.addEnc("$i2", "#0-65535", v => this.inrange(65535, v, v))

            U.iterMap(target.vmOpCodes, (opnamefull, opcode) => {
                let m = /(.*)_(\d+)/.exec(opnamefull)
                let fmt = ""
                if (m[1] == "call") fmt = "call $i1, $i2"
                else if (m[2] == "0") fmt = m[1]
                else if (m[2] == "1") fmt = m[1] + " $i1"
                else if (m[2] == "2") fmt = m[1] + " $i2"
                else oops()
                let ins = new VmInstruction(this, fmt, opcode)
                if (!this.instructions.hasOwnProperty(ins.name))
                    this.instructions[ins.name] = [];
                this.instructions[ins.name].push(ins)
            })
        }

        public testAssembler() {
        }

        public postProcessRelAddress(f: assembler.File, v: number): number {
            return v + f.baseOffset;
        }

        // absolute addresses come in divide by two
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
            return 2
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
        }


    }


}
