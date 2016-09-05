import re

# extract assembly from disassembly of hex file 

# basic format

#  addr: b0 b1 [b2 b3]  assem  ; comment
#  addr: ...            .directive
#  addr: ...            branch .[+-]N

# examples:

#  0:	0c 94 21 01 	jmp	0x242	;  0x242
#  ca:	08 00       	.word	0x0008	; ????
# 2ba:	30 f4       	brcc	.+12     	;  0x2c8

class Instruction:
    def __init__(self):
        self.addr = -1
        self.label = ""
        self.isDirective = False;
        self.opcode = ""
        self.encoding = ""
        self.operands = []
        self.relative = ""
    def toString(self):
        return self.encoding + " " + (self.label + ": " if self.label != "" else "") + self.opcode + " " + ", ".join(self.operands)

def gethex(t):
    hex = re.match("0x([a-zA-Z0-9]*)",t)
    return hex

file = open("assem.txt")
addr_map = dict({})
code = []
for line in file:
    relative = ""
    # tokenize on whitespace
    tokens = line.split()
    # check for address
    # skip if no address
    if (len(tokens)>0):
        addr = re.match("([0-9a-zA-Z]*):",tokens[0])
        if addr:
            a = addr.group(1)
            # print("ADDR = ", a)
            instruction = addr_map[a] = Instruction()
            instruction.addr = a
            code.append(instruction)
            i = 1
            hex2 = re.match("[a-f0-9][a-f0-9]$", tokens[i])
            fullhex = []
            ## get the hex values at this address
            while(hex2):
                fullhex.append(hex2.group(0))
                i = i + 1
                hex2 = re.match("[a-f0-9][a-f0-9]$", tokens[i])
            if (len(fullhex)>1):
                tmp = fullhex[0]
                fullhex[0] = fullhex[1]
                fullhex[1] = tmp
            if (len(fullhex)>2):
                tmp = fullhex[2]
                fullhex[2] = fullhex[3]
                fullhex[3] = tmp                
            # print("CONTENTS = ", fullhex)
            instruction.encoding = "".join(fullhex);
            # now, we either should have an assembly instruction or a directive
            directive = re.match("\.(.*)",tokens[i])
            if directive:
                # print("DIR = ", directive.group(1))
                instruction.isDirective = True;
                instruction.opcode = directive.group(0)
                h = gethex(tokens[i+1])
                instruction.operands = [ h.group(0) ]
            else:
                # should be an instruction
                opcode = re.match("[a-z]*",tokens[i])
                if opcode:
                    instruction.opcode = opcode.group(0)
                    # print("OP = ",inst.group(0))
                    i = i + 1
                    while(i<len(tokens) and tokens[i] != ";"):
                        # remove ,
                        tokens[i] = re.sub(",","",tokens[i])
                        h = gethex(tokens[i])
                        if h:
                            assert(h.group(0) != "")
                            # print("HEX_IMM = ",h.group(1))
                            # keep the 0x to distinguish from decimal
                            instruction.operands.append(h.group(0))
                        else:
                            reg = re.match("^r\d+$|^X$|^Y$|^Z$|^\-X$|^X\+$|^\-Y$|^Y\+$|^\-Z$|^Z\+$|^Y\+(\d+)$|^Z\+(\d+)$",tokens[i])
                            if (reg):
                                #print ("REG =", reg.group(0))
                                if (reg.group(1)):
                                    instruction.operands.append(tokens[i][0])
                                    instruction.operands.append("#" + reg.group(1))
                                elif (reg.group(2)):
                                    instruction.operands.append(tokens[i][0])
                                    instruction.operands.append("#" + reg.group(2))
                                else:
                                    instruction.operands.append(reg.group(0))
                            else:
                                relative = re.match("\.([\+\-]\d+)",tokens[i])
                                if (relative):
                                    #print ("REL =", relative.group(1))
                                    instruction.operands.append(relative.group(1))
                                    instruction.relative = relative.group(1)
                                else:
                                    dec = re.match("\d+",tokens[i])
                                    if (dec):
                                        # print("DEC_IMM = ", dec.group(0))
                                        instruction.operands.append("#" + dec.group(0))
                                    else:
                                        print("DIE = ",tokens[i])
                                        assert(0)
                        i = i + 1
                    # replace relative jump by absolute address
                    if relative:
                        assert(tokens[i] == ";")
                        h = gethex(tokens[i+1])
                        instruction.operands[0] = h.group(0)                        
                else:
                    assert(False)

## now find the addresses which are targets of jumps

lbl = 1
labels = dict({})
calls = dict({})
for i in code:
    a = i.addr
    if (i.opcode == "jmp" or i.opcode=="call" or i.relative != ""):
        # skip the 0x
        addr = i.operands[0][2:]
        if not (addr in labels): 
            # new target address
            labels[addr] = "L" + str(lbl)
            if (i.opcode == "call"):
                calls[addr] = labels[addr] 
            # add label to instruction, if we have it
            if (addr in addr_map):
                addr_map[addr].label = labels[addr]
            lbl = lbl + 1

# replace addresses by labels in operand lists
for i in code:   
    if (i.relative != ""):
        # skip the 0x
        addr = i.operands[0][2:]
        if (addr in labels):
            i.operands[0] = labels[addr]

# TODO: create a test file
#        assembler.expect(avr,
#            "0c00      lsl     r0\n" +
#            "920f      push    r0\n" +
#            "e604      ldi     r16, #100        ; 0x64\n" +
#            "903f      pop     r3\n")


def header(a):
    return "assembler.expect(avr,\n" + "\".startaddr " + a + "\\n\" +\n"

file_out = open("out.ts","w")
result = ""
for asm in code:
    if asm.addr in calls:
        if result != "":
            result = result + "\"\")\n\n"
            file_out.write(result)
        result = header(asm.addr)
    if result != "":
        result = result + "\"" + (asm.toString()) + "\\n\" +\n"
if (result != ""):
    result = result + "\"\")\n\n"
    file_out.write(result)
file_out.close()




