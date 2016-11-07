namespace pxsim {
    export class MicroServoState {
        angle: number = 0;
        physicalAngle: number = 0;

        public setAngle(angle: number) {
            this.angle = Math.max(0, Math.min(180, angle));
        }
    }

    export class MicroServosState {
        public servos: {
            [index: number]: MicroServoState;
        } = {};

        public servoState(pin: number): MicroServoState {
            let state = this.servos[pin];
            if (!state) state = this.servos[pin] = new MicroServoState();
            return state;
        }
    }
}
