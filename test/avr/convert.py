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

def gethex(t):
    hex = re.match("0x([a-zA-Z0-9]*)",t)
    return hex

file = open("assem.txt")
addr_map = dict({})
for line in file:
    # tokenize on whitespace
    tokens = line.split()
    # check for address
    # skip if no address
    if (len(tokens)>0):
        addr = re.match("([0-9a-zA-Z]*):",tokens[0])
        if addr:
            a = addr.group(1)
            print("ADDR = ", a)
            addr_map[a] = "yes"
            i = 1
            hex2 = re.match("[a-f0-9][a-f0-9]$", tokens[i])
            fullhex = ""
            ## get the hex values at this address
            while(hex2):
                fullhex = fullhex + hex2.group(0)
                i = i + 1
                hex2 = re.match("[a-f0-9][a-f0-9]$", tokens[i])
            print("CONTENTS = ", fullhex)
            # now, we either should have an assembly instruction or a directive
            directive = re.match("\.(.*)",tokens[i])
            if directive:
                print("DIR = ", directive.group(1))
                h = gethex(tokens[i+1])
                assert(h)
            else:
                # should be an instruction
                inst = re.match("[a-z]*",tokens[i])
                if inst:
                    print("OP = ",inst.group(0))
                    i = i + 1
                    while(i<len(tokens) and tokens[i] != ";"):
                        h = gethex(tokens[i])
                        if h:
                            assert(h.group(1) != "")
                            print("HEX_IMM = ",h.group(1))
                            pass
                        else:
                            reg = re.match("(r\d+|X|Y|Z|\-X|\+X|Y\+\d+|Z\+\d+)",tokens[i])
                            if (reg):
                                print ("REG =", reg.group(1))
                            else:
                                relative = re.match("\.([\+\-]\d+)",tokens[i])
                                if (relative):
                                    print ("REL =", relative.group(1))
                                else:
                                    dec = re.match("\d+",tokens[i])
                                    if (dec):
                                        print("DEC_IMM = ", dec.group(0))
                                    else:
                                        print("DIE = ",tokens[i])
                                        assert(0)
                        # extract any hex value    
                        # or branch offset
                        i = i + 1
                else:
                    assert(0)
