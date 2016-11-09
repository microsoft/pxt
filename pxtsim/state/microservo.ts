namespace pxsim {
    export class MicroServoState {
        angle: number = 0;
        physicalAngle: number = 0;

        public setAngle(angle: number) {
            this.angle = Math.max(0, Math.min(180, angle));
        }
    }

    export interface MicroServosProps {
        [name: string]: number;
    }

    export class MicroServosState {
        public servos: {
            [pinid: number]: MicroServoState;
        } = {};

        constructor(public props: MicroServosProps) {}

        public servoState(pinid: number): MicroServoState {
            let state = this.servos[pinid];
            if (!state) state = this.servos[pinid] = new MicroServoState();
            return state;
        }
    }
}
