namespace ks.rt.micro_bit {
    export interface RuntimeOptions {
        theme: string;
    }
    
    export enum DisplayMode {
        bw,
        greyscale
    }
    
    export enum PinMode {
        Digital = 0x0001,
        Analog  = 0x0002,
        Input   = 0x0004,
        Output  = 0x0008,
        Touch   = 0x0010
    }
    
    export class Pin {
        constructor(public id: number) {}
        touched = false;
        value = 0;
        mode = PinMode.Digital | PinMode.Output;
          
        isTouched() : boolean {
            this.mode = PinMode.Touch;
            return this.touched;
        }
    }
    
    export class Button {
        constructor(public id : number) {}
        pressed: boolean;
    }
    
    export class EventBus {
        private queues : Map<EventQueue<number>> = {};
        
        constructor(private runtime : Runtime) { }
        
        listen(id:number, evid:number, handler: RefAction) {
            let k = id + ':' + evid;           
            let queue = this.queues[k];
            if (!queue) queue = this.queues[k] = new EventQueue<number>(this.runtime);
            queue.handler = handler;
        }
        
        queue(id: number, evid: number, value: number = 0) {
            let k = id + ':' + evid;           
            let queue = this.queues[k];
            if (queue) queue.push(value);
        }
    }
    
    export interface PacketBuffer {
        data:number[];
        rssi?:number;
    }
    
    export class RadioDatagram {
        datagram: PacketBuffer[] = [];
        lastReceived: PacketBuffer = { 
            data:[0,0,0,0], 
            rssi: -1 
        };
        
        constructor(private runtime : Runtime) { 
        }
        
        queue(packet : PacketBuffer) {
            if (this.datagram.length < 5) {
                this.datagram.push(packet);
                let ens = enums();
                (<Board>runtime.board).bus.queue(ens.MICROBIT_ID_RADIO, ens.MICROBIT_RADIO_EVT_DATAGRAM);
            }
        }
        
        send(buffer : number[]) {
            Runtime.postMessage(<SimulatorRadioPacketMessage>{
                type:'radiopacket',
                data: buffer.slice(0, 8)
            })
        }
        
        recv() : PacketBuffer {
            var r = this.datagram.shift();
            if (!r) r = { 
                data:[0,0,0,0], 
                rssi: -1 
            };
            return this.lastReceived = r;
        }
    }
    
    export class RadioBus {
        // uint8_t radioDefaultGroup = MICROBIT_RADIO_DEFAULT_GROUP;
        groupId = 0; // todo
        datagram : RadioDatagram;
            
        constructor(private runtime : Runtime) { 
            this.datagram = new RadioDatagram(runtime);
        }
        
        setGroup(id: number) {
            this.groupId = id & 0xff; // byte only
        }
        
        broadcast(msg: number) {
            let ens = enums();
            Runtime.postMessage(<SimulatorEventBusMessage>{
                type:'eventbus',
                id: ens.MES_BROADCAST_GENERAL_ID,
                eventid: msg
            })
        }
    }
    
    export interface SimulatorEventBusMessage extends SimulatorMessage {
        id: number;
        eventid: number;
        value?: number;
    }
    
    export interface SimulatorSerialMessage extends SimulatorMessage {
        id:string;
        data: string;
    }
    
    export interface SimulatorRadioPacketMessage extends SimulatorMessage {
        data: number[];
        rssi?: number;
    }
    
    export class Board extends BaseBoard {
        id: string;
        
        // the bus
        bus : EventBus;
        radio: RadioBus;

        // display
        image = createImage(5);
        brigthness = 255;
        displayMode = DisplayMode.bw;
        font: Image = createFont();

        // buttons    
        usesButtonAB: boolean = false;
        buttons : Button[];

        // pins
        pins : Pin[];
        
        // serial
        serialIn: string[] = [];

        // sensors    
        usesAcceleration = false;
        acceleration = [0, 0, -1023];
        
        usesHeading = false;        
        heading = 90;
        
        temperature = 21;
        lightLevel = 128;
        
        animationQ: AnimationQueue;
        
        constructor() {
            super()
            this.id = "b" + Math.random();
            this.animationQ = new AnimationQueue(runtime);
            this.bus = new EventBus(runtime);
            this.radio = new RadioBus(runtime);
            let ens = enums();
            this.buttons = [
                new Button(ens.MICROBIT_ID_BUTTON_A),
                new Button(ens.MICROBIT_ID_BUTTON_B),
                new Button(ens.MICROBIT_ID_BUTTON_AB)
            ];
            this.pins = [
                new Pin(ens.MICROBIT_ID_IO_P0),
                new Pin(ens.MICROBIT_ID_IO_P1),
                new Pin(ens.MICROBIT_ID_IO_P2),
                new Pin(ens.MICROBIT_ID_IO_P3),
                new Pin(ens.MICROBIT_ID_IO_P4),
                new Pin(ens.MICROBIT_ID_IO_P5),
                new Pin(ens.MICROBIT_ID_IO_P6),
                new Pin(ens.MICROBIT_ID_IO_P7),
                new Pin(ens.MICROBIT_ID_IO_P8),
                new Pin(ens.MICROBIT_ID_IO_P9),
                new Pin(ens.MICROBIT_ID_IO_P10),
                new Pin(ens.MICROBIT_ID_IO_P11),
                new Pin(ens.MICROBIT_ID_IO_P12),
                new Pin(ens.MICROBIT_ID_IO_P13),
                new Pin(ens.MICROBIT_ID_IO_P14),
                new Pin(ens.MICROBIT_ID_IO_P15),
                new Pin(ens.MICROBIT_ID_IO_P16),
                null, 
                null,                
                new Pin(ens.MICROBIT_ID_IO_P19),
                new Pin(ens.MICROBIT_ID_IO_P20)
            ];
        }
        
        
        initAsync(msg : SimulatorRunMessage) : Promise<void> {
            let options = (msg.options || {}) as RuntimeOptions;
            let theme : micro_bit.IBoardTheme;
            switch(options.theme) {
                case 'blue': theme = micro_bit.themes[0]; break;
                case 'yellow': theme = micro_bit.themes[1]; break;
                case 'green': theme = micro_bit.themes[2]; break;
                case 'red': theme = micro_bit.themes[3]; break;
                default: theme  = ks.rt.micro_bit.randomTheme();
            }
            
            console.log('setting up microbit simulator')
            let view = new ks.rt.micro_bit.MicrobitBoardSvg({
                theme: theme,
                runtime: runtime
            })
            document.body.innerHTML = ''; // clear children
            document.body.appendChild(view.element);
            
            return Promise.resolve();          
        }
                
        receiveMessage(msg: SimulatorMessage) {
            if (!runtime || runtime.dead) return;
            
            switch(msg.type || "") {
                case 'eventbus': 
                    let ev = <SimulatorEventBusMessage>msg;
                    this.bus.queue(ev.id, ev.eventid, ev.value);
                    break;
            case 'serial':
                    this.serialIn.push((<SimulatorSerialMessage>msg).data || '');
                    break;
                case 'radiopacket':
                    let packet = <SimulatorRadioPacketMessage>msg;
                    this.radio.datagram.queue({ data: packet.data || [], rssi: packet.rssi || 0})
                    break;
            }
        }
        
        readSerial() {
            let v = this.serialIn.shift() || '';
            return v;
        }
        
        serialOutBuffer: string = '';
        writeSerial(s : string) {
            for(let i = 0; i < s.length;++i) {
                let c = s[i];
                switch(c) {
                    case '\n': 
                        Runtime.postMessage(<SimulatorSerialMessage>{
                            type: 'serial',
                            data: this.serialOutBuffer,
                            id: runtime.id
                        })   
                        this.serialOutBuffer = ''
                        break;
                    case '\r': continue;
                    default: this.serialOutBuffer += c;
                }                
            }
        }
    }

    export class Image {
        public width: number;
    public data: number[];
        constructor(width: number, data: number[]) {
            this.width = width;
            this.data = data;
        }
        public get(x: number, y: number): number {
            // TODO range checking
            return this.data[y * this.width + x];
        }
        public set(x: number, y: number, v: number) {
            // TODO range checking
            this.data[y * this.width + x] = v;
        }
        public copyTo(xSrcIndex: number, length: number, target: Image, xTargetIndex: number): void {
            for (let x = 0; x < length; x++) {
                for (let y = 0; y < 5; y++) {
                    let value = this.get(xSrcIndex + x, y);
                    target.set(xTargetIndex + x, y, value);
                }
            }
        }
        public clear() : void {
            for(var i = 0;i < this.data.length; ++i)
                this.data[i] = 0;
        }
    }

    export function createImage(width: number): Image {
        return new Image(width, new Array(width * 5));
    }

    export function createImageFromBuffer(data: number[]): Image {
        return new Image(data.length / 5, data);
    }

    export function createImageFromString(text: string): Image {
        let font = board().font;
        let w = font.width;
        let sprite = createImage(6 * text.length - 1);
        let k = 0;
        for (let i = 0; i < text.length; i++) {
            let charCode = text.charCodeAt(i);
            let charStart = (charCode - 32) * 5;
            if (charStart < 0 || charStart + 5 > w) {
                charCode = " ".charCodeAt(0);
                charStart = (charCode - 32) * 5;
            }

            font.copyTo(charStart, 5, sprite, k);
            k = k + 5;
            if (i < text.length - 1) {
                k = k + 1;
            }
        }
        return sprite;
    }

    export function createFont(): Image {
        var data = [0x0, 0x0, 0x0, 0x0, 0x0, 0x8, 0x8, 0x8, 0x0, 0x8, 0xa, 0x4a, 0x40, 0x0, 0x0, 0xa, 0x5f, 0xea, 0x5f, 0xea, 0xe, 0xd9, 0x2e, 0xd3, 0x6e, 0x19, 0x32, 0x44, 0x89, 0x33, 0xc, 0x92, 0x4c, 0x92, 0x4d, 0x8, 0x8, 0x0, 0x0, 0x0, 0x4, 0x88, 0x8, 0x8, 0x4, 0x8, 0x4, 0x84, 0x84, 0x88, 0x0, 0xa, 0x44, 0x8a, 0x40, 0x0, 0x4, 0x8e, 0xc4, 0x80, 0x0, 0x0, 0x0, 0x4, 0x88, 0x0, 0x0, 0xe, 0xc0, 0x0, 0x0, 0x0, 0x0, 0x8, 0x0, 0x1, 0x22, 0x44, 0x88, 0x10, 0xc, 0x92, 0x52, 0x52, 0x4c, 0x4, 0x8c, 0x84, 0x84, 0x8e, 0x1c, 0x82, 0x4c, 0x90, 0x1e, 0x1e, 0xc2, 0x44, 0x92, 0x4c, 0x6, 0xca, 0x52, 0x5f, 0xe2, 0x1f, 0xf0, 0x1e, 0xc1, 0x3e, 0x2, 0x44, 0x8e, 0xd1, 0x2e, 0x1f, 0xe2, 0x44, 0x88, 0x10, 0xe, 0xd1, 0x2e, 0xd1, 0x2e, 0xe, 0xd1, 0x2e, 0xc4, 0x88, 0x0, 0x8, 0x0, 0x8, 0x0, 0x0, 0x4, 0x80, 0x4, 0x88, 0x2, 0x44, 0x88, 0x4, 0x82, 0x0, 0xe, 0xc0, 0xe, 0xc0, 0x8, 0x4, 0x82, 0x44, 0x88, 0xe, 0xd1, 0x26, 0xc0, 0x4, 0xe, 0xd1, 0x35, 0xb3, 0x6c, 0xc, 0x92, 0x5e, 0xd2, 0x52, 0x1c, 0x92, 0x5c, 0x92, 0x5c, 0xe, 0xd0, 0x10, 0x10, 0xe, 0x1c, 0x92, 0x52, 0x52, 0x5c, 0x1e, 0xd0, 0x1c, 0x90, 0x1e, 0x1e, 0xd0, 0x1c, 0x90, 0x10, 0xe, 0xd0, 0x13, 0x71, 0x2e, 0x12, 0x52, 0x5e, 0xd2, 0x52, 0x1c, 0x88, 0x8, 0x8, 0x1c, 0x1f, 0xe2, 0x42, 0x52, 0x4c, 0x12, 0x54, 0x98, 0x14, 0x92, 0x10, 0x10, 0x10, 0x10, 0x1e, 0x11, 0x3b, 0x75, 0xb1, 0x31, 0x11, 0x39, 0x35, 0xb3, 0x71, 0xc, 0x92, 0x52, 0x52, 0x4c, 0x1c, 0x92, 0x5c, 0x90, 0x10, 0xc, 0x92, 0x52, 0x4c, 0x86, 0x1c, 0x92, 0x5c, 0x92, 0x51, 0xe, 0xd0, 0xc, 0x82, 0x5c, 0x1f, 0xe4, 0x84, 0x84, 0x84, 0x12, 0x52, 0x52, 0x52, 0x4c, 0x11, 0x31, 0x31, 0x2a, 0x44, 0x11, 0x31, 0x35, 0xbb, 0x71, 0x12, 0x52, 0x4c, 0x92, 0x52, 0x11, 0x2a, 0x44, 0x84, 0x84, 0x1e, 0xc4, 0x88, 0x10, 0x1e, 0xe, 0xc8, 0x8, 0x8, 0xe, 0x10, 0x8, 0x4, 0x82, 0x41, 0xe, 0xc2, 0x42, 0x42, 0x4e, 0x4, 0x8a, 0x40, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x1f, 0x8, 0x4, 0x80, 0x0, 0x0, 0x0, 0xe, 0xd2, 0x52, 0x4f, 0x10, 0x10, 0x1c, 0x92, 0x5c, 0x0, 0xe, 0xd0, 0x10, 0xe, 0x2, 0x42, 0x4e, 0xd2, 0x4e, 0xc, 0x92, 0x5c, 0x90, 0xe, 0x6, 0xc8, 0x1c, 0x88, 0x8, 0xe, 0xd2, 0x4e, 0xc2, 0x4c, 0x10, 0x10, 0x1c, 0x92, 0x52, 0x8, 0x0, 0x8, 0x8, 0x8, 0x2, 0x40, 0x2, 0x42, 0x4c, 0x10, 0x14, 0x98, 0x14, 0x92, 0x8, 0x8, 0x8, 0x8, 0x6, 0x0, 0x1b, 0x75, 0xb1, 0x31, 0x0, 0x1c, 0x92, 0x52, 0x52, 0x0, 0xc, 0x92, 0x52, 0x4c, 0x0, 0x1c, 0x92, 0x5c, 0x90, 0x0, 0xe, 0xd2, 0x4e, 0xc2, 0x0, 0xe, 0xd0, 0x10, 0x10, 0x0, 0x6, 0xc8, 0x4, 0x98, 0x8, 0x8, 0xe, 0xc8, 0x7, 0x0, 0x12, 0x52, 0x52, 0x4f, 0x0, 0x11, 0x31, 0x2a, 0x44, 0x0, 0x11, 0x31, 0x35, 0xbb, 0x0, 0x12, 0x4c, 0x8c, 0x92, 0x0, 0x11, 0x2a, 0x44, 0x98, 0x0, 0x1e, 0xc4, 0x88, 0x1e, 0x6, 0xc4, 0x8c, 0x84, 0x86, 0x8, 0x8, 0x8, 0x8, 0x8, 0x18, 0x8, 0xc, 0x88, 0x18, 0x0, 0x0, 0xc, 0x83, 0x60];

        let nb = data.length;
        let n = nb / 5;
        var font = createImage(nb);
        for (let c = 0; c < n; c++) {
            for (let row = 0; row < 5; row++) {
                let char = data[c * 5 + row];
                for (let col = 0; col < 5; col++) {
                    if ((char & (1 << col)) != 0)
                        font.set((c * 5 + 4) - col, row, 255);
                }
            }
        }
        return font;
    }
}