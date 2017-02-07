
namespace pxt.serialflash {
 

}


// source for samd21flash

/*
#define wait_ready() \
        while (NVMCTRL->INTFLAG.bit.READY == 0);
    
void flash_write(void) {
    uint32_t *src = (void *)0x20006000;
    uint32_t *dst = (void *)*src++;
    uint32_t n_rows = *src++;

    NVMCTRL->CTRLB.bit.MANW = 1;
    while (n_rows--) {
        wait_ready();
        NVMCTRL->STATUS.reg = NVMCTRL_STATUS_MASK;

        // Execute "ER" Erase Row
        NVMCTRL->ADDR.reg = (uint32_t)dst / 2;
        NVMCTRL->CTRLA.reg = NVMCTRL_CTRLA_CMDEX_KEY | NVMCTRL_CTRLA_CMD_ER;
        wait_ready();

        // there are 4 pages to a row
        for (int i = 0; i < 4; ++i) {
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
}
*/
