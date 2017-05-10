
namespace pxsim {
    export class ToggleState {
        on = false;

        constructor (private pin: Pin) { }

        toggle() {
            this.on = !this.on;
            if (this.on) {
                this.pin.value = 200;
            }
            else {
                this.pin.value = 0;
            }
        }
    }

    export interface ToggleStateConstructor {
        (pin: Pin): ToggleState;
    }
}
