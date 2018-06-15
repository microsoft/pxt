import * as fs from 'fs';
import * as nodeutil from './nodeutil';
import * as commandParser from './commandparser';

import U = pxt.Util;

function requireSerialPort(install?: boolean): any {
    return nodeutil.lazyRequire("serialport", install);
}

export function isInstalled(): boolean {
    return !!requireSerialPort(false);
}

export interface SerialPortInfo {
    comName: string;
    pnpId: string;
    manufacturer: string;
    vendorId: string;
    productId: string;

    opened?: boolean;
    port?: any;
}

export function monitorSerial(onData: (info: SerialPortInfo, buffer: Buffer) => void) {
    if (!pxt.appTarget.serial || !pxt.appTarget.serial.log) return;
    if (pxt.appTarget.serial.useHF2) {
        return
    }
    const serialPort = requireSerialPort(true);
    if (!serialPort)
        return;

    pxt.log('serial: monitoring ports...')

    const serialPorts: pxt.Map<SerialPortInfo> = {};
    function close(info: SerialPortInfo) {
        console.log('serial: closing ' + info.pnpId);
        delete serialPorts[info.pnpId];
    }

    function open(info: SerialPortInfo) {
        console.log(`serial: connecting to ${info.comName} by ${info.manufacturer} (${info.pnpId})`);
        serialPorts[info.pnpId] = info;
        info.port = new serialPort(info.comName, {
            baudRate: 115200,
            autoOpen: false
        }); // this is the openImmediately flag [default is true]
        info.port.open(function (error: any) {
            if (error) {
                console.log('failed to open: ' + error);
                close(info);
            } else {
                console.log(`serial: connected to ${info.comName} by ${info.manufacturer} (${info.pnpId})`);
                info.opened = true;
                info.port.on('data', (buffer: Buffer) => onData(info, buffer));
                info.port.on('error', function () { close(info); });
                info.port.on('close', function () { close(info); });
            }
        });
    }

    const vendorFilter = pxt.appTarget.serial.vendorId ? parseInt(pxt.appTarget.serial.vendorId, 16) : undefined;
    const productFilter = pxt.appTarget.serial.productId ? parseInt(pxt.appTarget.serial.productId, 16) : undefined;

    function filterPort(info: SerialPortInfo): boolean {
        let retVal = true;
        if (vendorFilter)
            retVal = retVal && (vendorFilter == parseInt(info.vendorId, 16));
        if (productFilter)
            retVal = retVal && (productFilter == parseInt(info.productId, 16));
        return retVal;
    }

    setInterval(() => {
        serialPort.list(function (err: any, ports: SerialPortInfo[]) {
            ports.filter(filterPort)
                .filter(info => !serialPorts[info.pnpId])
                .forEach((info) => open(info));
        });
    }, 5000);
}

class Serial {
    buf = new U.PromiseBuffer<Buffer>()
    isclosed = false;
    partialBuf: Buffer;
    partialPos = 0;
    lock = new U.PromiseQueue()
    openpromise: Promise<void>;

    constructor(public serialPort: any, public info: SerialPortInfo) {
        info.port = new serialPort(info.comName, {
            baudrate: 115200,
            autoOpen: false
        }); // this is the openImmediately flag [default is true]
        this.openpromise = new Promise<void>((resolve, reject) => {
            info.port.open((error: any) => {
                if (error) {
                    console.log('failed to open: ' + error);
                    reject(error)
                } else {
                    console.log(`serial: connected to ${info.comName} by ${info.manufacturer} (${info.pnpId})`);
                    info.opened = true;
                    info.port.on('data', (buffer: Buffer) => {
                        // console.log("S: " + buffer.toString("hex"))
                        this.buf.push(buffer)
                    });
                    info.port.on('error', () => this.close())
                    info.port.on('close', () => this.close())
                    resolve()
                }
            });
        })
    }

    writeAsync(buf: string | Buffer) {
        if (typeof buf == "string")
            buf = new Buffer(buf as string, "utf8")
        return this.openpromise
            .then(() => this.isclosed ? Promise.reject(new Error("closed (write)")) : null)
            .then(() => new Promise<void>((resolve, reject) => {
                this.info.port.write(buf, (err: any) => {
                    if (err) reject(err)
                    else resolve()
                })
            }))
    }

    readBlockingAsync(size: number) {
        let res = new Buffer(size)
        let i = 0
        if (this.partialBuf) {
            for (i = 0; i < size; ++i) {
                if (this.partialPos >= this.partialBuf.length) {
                    this.partialBuf = null
                    break
                }
                res[i] = this.partialBuf[this.partialPos++]
            }
        }
        if (i >= size) return Promise.resolve(res)
        let loop = (): Promise<Buffer> =>
            this.readCoreAsync()
                .then(buf => {
                    let j = 0
                    while (i < size) {
                        if (j >= buf.length) break
                        res[i++] = buf[j++]
                    }
                    if (i >= size) {
                        if (j < buf.length) {
                            this.partialBuf = buf
                            this.partialPos = j
                        }
                        return res
                    }
                    return loop()
                })
        return this.lock.enqueue("main", loop)
    }

    readCoreAsync() {
        if (this.isclosed)
            return Promise.reject<Buffer>(new Error("closed (read core)"))
        return this.buf.shiftAsync()
    }

    close() {
        this.buf.drain()
        if (this.isclosed) return
        this.isclosed = true
        this.info.port.close()
    }
}

const samd21 = {
    flash: [
        0xb5f02180, 0x68184b1a, 0x681c4b1a, 0x685a4b1a, 0x605a430a, 0x3c014a19,
        0x7d1dd329, 0x07ed4916, 0x2520d5fb, 0x830d35ff, 0x61cd0845, 0x800d4d14,
        0x07c97d19, 0x4913d5fc, 0x468c0005, 0x37ff1c57, 0x80194911, 0x07c97d19,
        0x2100d5fc, 0x506e5856, 0x29403104, 0x4661d1fa, 0x35403240, 0x7d198019,
        0xd5fc07c9, 0xd1eb4297, 0x30ff3001, 0xbdf0e7d3, 0x20006000, 0x20006004,
        0x41004000, 0x20006008, 0xffffa502, 0xffffa504, 0xffffa544,
    ],
    reset: [
        0x4b064a05, 0xf3bf601a, 0x4a058f4f, 0x60da4b05, 0x8f4ff3bf, 0x46c0e7fe,
        0xf02669ef, 0x20007ffc, 0x05fa0004, 0xe000ed00,
    ]
}

function sambaCmd(ch: string, addr: number, len?: number) {
    let r = ch + addr.toString(16)
    if (len != null)
        r += "," + len.toString(16)
    return r + "#"
}
export function flashSerialAsync(c: commandParser.ParsedCommand) {
    const serialPort = requireSerialPort(true);
    if (!serialPort)
        return Promise.resolve();
    let listAsync: () => Promise<SerialPortInfo[]> = Promise.promisify(serialPort.list) as any

    let f = fs.readFileSync(c.args[0])
    let blocks = pxtc.UF2.parseFile(f as any)
    let s: Serial

    let writeMemAsync = (addr: number, buf: Buffer) =>
        s.writeAsync(sambaCmd("S", addr, buf.length))
            .then(() => s.writeAsync(buf))

    let pingAsync = () =>
        s.writeAsync(sambaCmd("R", 0, 4))
            .then(() => s.readBlockingAsync(4))

    let currApplet: number[] = null
    let goCmd = ""

    let saveAppletAsync = (appl: number[]) => {
        if (currApplet == appl) return Promise.resolve()
        currApplet = appl
        let writeBuf = new Buffer(appl.length * 4 + 8)
        for (let i = 0; i < appl.length; i++)
            pxt.HF2.write32(writeBuf, i * 4, appl[i])
        let code = 0x20008000 - 512
        pxt.HF2.write32(writeBuf, appl.length * 4, 0x20007ff0) // stack
        pxt.HF2.write32(writeBuf, appl.length * 4 + 4, code + 1) // start addr (+1 for Thumb)
        goCmd = sambaCmd("G", code + writeBuf.length - 8)
        return writeMemAsync(code, writeBuf)
    }

    let runAppletAsync = (appl: number[]) =>
        saveAppletAsync(appl)
            .then(() => s.writeAsync(goCmd))

    let writeBlockAsync = (b: pxtc.UF2.Block) => {
        let hd = new Buffer(8)
        pxt.HF2.write32(hd, 0, b.targetAddr)
        pxt.HF2.write32(hd, 4, 1)
        return writeMemAsync(0x20006000, Buffer.concat([hd, b.data as any]))
            .then(() => runAppletAsync(samd21.flash))
            .then(pingAsync)
    }

    let readWordsAsync = (addr: number, len: number) => {
        return s.writeAsync(sambaCmd("R", addr, len * 4))
            .then(() => s.readBlockingAsync(len * 4))
    }

    return listAsync()
        .then(ports => {
            let p = ports.filter(p => /Arduino|Adafruit/i.test(p.manufacturer))[0]
            s = new Serial(serialPort, p);
            return pxt.HF2.onlyChangedBlocksAsync(blocks, readWordsAsync)
                .then(lessBlocks => {
                    console.log(`flash ${blocks.length} pages -> ${lessBlocks.length} pages`)
                    return Promise.mapSeries(lessBlocks, writeBlockAsync)
                        .then(() => {
                            console.log("all done; resetting...")
                            return runAppletAsync(samd21.reset)
                        })
                        .then(() => s.close())
                })
        })
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
