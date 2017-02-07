
namespace pxt.serialflash {
    let samd21flash = [
        0xb5f02180, 0x4f194b18, 0x4b196818, 0x4b19681c, 0x430a685a, 0x605a4918,
        0x18451a09, 0xd3213c01, 0x4a147d1e, 0xd5fb07f6, 0x36ff2620, 0x08468316,
        0x801761d6, 0x07d27d1a, 0x4a10d5fc, 0x46664694, 0x80164a0c, 0x07d27d1a,
        0x2200d5fc, 0x508658ae, 0x2a403204, 0x4a0ad1fa, 0x801a3040, 0x07d27d1a,
        0xe7dad5fc, 0x46c0bdf0, 0x20006000, 0xffffa502, 0x20006004, 0x41004000,
        0x20006008, 0xffffa544, 0xffffa504, // code ends
        0x20007ff0, // stack
        0x20008000 - 512 // base address
    ]

}


// source for samd21flash

    /*
    #define wait_ready() \
        while (NVMCTRL->INTFLAG.bit.READY == 0);
    
    void flash_write() {
        uint32_t *src = (void *)0x20006000;
        uint32_t *dst = (void *)*src++;
        uint32_t n_pages = *src++;
    
        NVMCTRL->CTRLB.bit.MANW = 1;
        while (n_pages--) {
            wait_ready();
            NVMCTRL->STATUS.reg = NVMCTRL_STATUS_MASK;
    
            // Execute "ER" Erase Row
            NVMCTRL->ADDR.reg = (uint32_t)dst / 2;
            NVMCTRL->CTRLA.reg = NVMCTRL_CTRLA_CMDEX_KEY | NVMCTRL_CTRLA_CMD_ER;
            wait_ready();
    
            // Execute "PBC" Page Buffer Clear
            NVMCTRL->CTRLA.reg = NVMCTRL_CTRLA_CMDEX_KEY | NVMCTRL_CTRLA_CMD_PBC;
            wait_ready();
    
            uint32_t len = FLASH_PAGE_SIZE >> 2;
            while (len--)
                *dst++ = *src++;
    
            // Execute "WP" Write Page
            NVMCTRL->CTRLA.reg = NVMCTRL_CTRLA_CMDEX_KEY | NVMCTRL_CTRLA_CMD_WP;
            wait_ready();
        }
    }
    */

// run this on output of objdump -d to get the hex numbers in samd21flash
    /*
let fs = require("fs")
let s = fs.readFileSync("flash.asm", "utf8")
let r = ""
let pref = ""
for (let l of s.split(/\n/)) {
    let m = /^\s*[0-9a-f]+:\s+([0-9a-f]+)\s+/.exec(l)
    if (m) {
        let n = m[1]
        if (n.length == 4) {
            if (pref) {
                r += "0x" + n + pref + ", "
                pref = ""
            } else {
                pref = n
            }
        } else if (n.length == 8) {
            if (pref) throw new Error()
            r += "0x" + n + ", "
        } else {
            throw new Error()
        }
    }
}
    */
