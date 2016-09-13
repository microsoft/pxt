namespace pxsim {
    export enum PinFlags {
        Unused = 0,
        Digital = 0x0001,
        Analog = 0x0002,
        Input = 0x0004,
        Output = 0x0008,
        Touch = 0x0010
    }

    export class Pin {
        constructor(public id: number) { }
        touched = false;
        value = 0;
        period = 0;
        mode = PinFlags.Unused;
        pitch = false;
        pull = 0; // PullDown

        isTouched(): boolean {
            this.mode = PinFlags.Touch;
            return this.touched;
        }
    }

    export interface EdgeConnectorProps {
        pins: number[];
    }

    export class EdgeConnectorState {
        pins: Pin[];

        constructor(props: EdgeConnectorProps) {
            this.pins = props.pins.map(id => id ? new Pin(id) : null);
        }

        public getPin(id: number) {
            return this.pins.filter(p => p && p.id == id)[0] || null
        }
    }

}