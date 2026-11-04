namespace pxsim {
    export class Button {
        constructor(public id: number) { }
        pressed: boolean;
        virtual: boolean;
    }

    export interface ButtonPairProps {
        ID_BUTTON_A: number;
        ID_BUTTON_B: number;
        ID_BUTTON_AB: number;
        BUTTON_EVT_UP: number;
        BUTTON_EVT_CLICK: number;
    }

    export class ButtonPairState {
        usesButtonAB: boolean = false;
        aBtn: Button;
        bBtn: Button;
        abBtn: Button;

        constructor(public props: ButtonPairProps) {
            this.aBtn = new Button(this.props.ID_BUTTON_A);
            this.bBtn = new Button(this.props.ID_BUTTON_B);
            this.abBtn = new Button(this.props.ID_BUTTON_AB);
            this.abBtn.virtual = true;
        }
    }
}