namespace pxsim {
    export enum ButtonEvent {
        UP,
        DOWN,
        CLICK,
        LONG_CLICK,
        HOLD
    }

    export class Button {
        constructor(public id: number, private fireEvent?: (eventId: ButtonEvent) => void, private holdTime = 1500, private longClickTime = 1000) { }
        virtual: boolean;
        parent: ButtonPairState;

        private _pressed: boolean = false;
        private downTime: number;
        private holdTimerId: number;

        get pressed() {
            return this._pressed;
        }

        set pressed(p: boolean) {
            if (p !== this._pressed) {
                this._pressed = p;
                if (this._pressed) {
                    this.downTime = Date.now();
                    this.tryFireEvent(ButtonEvent.DOWN);
                    this.holdTimerId = setTimeout(() => this.tryFireEvent(ButtonEvent.HOLD), this.holdTime);
                }
                else {
                    clearTimeout(this.holdTimerId);
                    const delta = Date.now() - this.downTime;
                    this.tryFireEvent(ButtonEvent.UP);

                    if (delta >= this.longClickTime) {
                        this.tryFireEvent(ButtonEvent.LONG_CLICK);
                    }
                    else {
                        this.tryFireEvent(ButtonEvent.CLICK);
                    }
                }
            };
        }

        public setPressedSilent(p: boolean) {
            this._pressed = p;
        }

        private tryFireEvent(eventId: ButtonEvent) {
            if (this.fireEvent) {
                this.fireEvent(eventId);
            }
        }
    }

    export interface ButtonPairProps {
        ID_BUTTON_A: number;
        ID_BUTTON_B: number;
        ID_BUTTON_AB: number;
        BUTTON_EVT_UP: number;
        BUTTON_EVT_CLICK: number
        BUTTON_EVT_DOWN?: number;
        BUTTON_EVT_LONG_CLICK?: number;
        BUTTON_EVT_HOLD?: number;

        // Time properties are in milliseconds
        BUTTON_HOLD_TIME?: number;
        BUTTON_LONG_CLICK_TIME?: number
    }

    export class ButtonPairState {
        usesButtonAB: boolean = false;
        aBtn: Button;
        bBtn: Button;
        abBtn: Button;

        private bus: EventBus;

        constructor(public props: ButtonPairProps) {
            this.aBtn = new Button(this.props.ID_BUTTON_A,
                ev => this.fireEventHandler(this.props.ID_BUTTON_A, ev),
                this.props.BUTTON_HOLD_TIME,
                this.props.BUTTON_LONG_CLICK_TIME);

            this.bBtn = new Button(this.props.ID_BUTTON_B,
                ev => this.fireEventHandler(this.props.ID_BUTTON_B, ev),
                this.props.BUTTON_HOLD_TIME,
                this.props.BUTTON_LONG_CLICK_TIME);

            this.abBtn = new Button(this.props.ID_BUTTON_AB,
                ev => this.fireEventHandler(this.props.ID_BUTTON_AB, ev),
                this.props.BUTTON_HOLD_TIME,
                this.props.BUTTON_LONG_CLICK_TIME);
            this.abBtn.virtual = true;
        }

        public setBus(bus: EventBus) {
            this.bus = bus;
        }

        private fireEventHandler(id: number, event: ButtonEvent) {
            switch (event) {
                case ButtonEvent.UP:
                    this.fireEvent(id, this.props.BUTTON_EVT_UP);
                    break;
                case ButtonEvent.CLICK:
                    this.fireEvent(id, this.props.BUTTON_EVT_CLICK);
                    break;
                case ButtonEvent.DOWN:
                    if (this.props.BUTTON_EVT_DOWN != undefined) {
                        this.fireEvent(id, this.props.BUTTON_EVT_DOWN);
                    }
                    break;
                case ButtonEvent.LONG_CLICK:
                    if (this.props.BUTTON_EVT_LONG_CLICK != undefined) {
                        this.fireEvent(id, this.props.BUTTON_EVT_LONG_CLICK);
                    }
                    else {
                        this.fireEvent(id, this.props.BUTTON_EVT_CLICK);
                    }
                    break;
                case ButtonEvent.HOLD:
                    if (this.props.BUTTON_EVT_HOLD != undefined) {
                        this.fireEvent(id, this.props.BUTTON_EVT_HOLD);
                    }
                    break;
            }
        }

        private fireEvent(id: number, eventId: number) {
            if (this.bus) {
                this.bus.queue(id, eventId);
            }
        }
    }
}