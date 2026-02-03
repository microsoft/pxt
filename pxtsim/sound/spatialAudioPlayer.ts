namespace pxsim.AudioContextManager {
    export enum DistanceModelValue {
        Linear = 0,
        Inverse = 1,
        Exponential = 2
    }
    export class SpatialAudioPlayer {
        protected static nextId = 1;
        protected static allPlayers: SpatialAudioPlayer[] = [];

        static disposeAll() {
            while (SpatialAudioPlayer.allPlayers.length) {
                SpatialAudioPlayer.allPlayers[0].dispose();
            }
        }

        static getPlayerById(id: number) {
            for (const player of SpatialAudioPlayer.allPlayers) {
                if (player.id === id) return player;
            }

            return undefined;
        }

        public readonly id = SpatialAudioPlayer.nextId++;
        protected panner: PannerNode;
        protected audioWorkletSource: AudioWorkletSource;

        constructor(
            protected context: AudioContext,
            destination: AudioNode,
        ) {
            SpatialAudioPlayer.allPlayers.push(this);

            this.panner = new PannerNode(context, {
                panningModel: 'HRTF',
                distanceModel: "linear",
                positionX: 0,
                positionY: 0,
                positionZ: 0,
                orientationX: 0,
                orientationY: 0,
                orientationZ: -1,
            });
            this.panner.connect(destination);
        }

        setPosition(x: number, y: number, z: number) {
            this.panner.positionX.setTargetAtTime(x, 0, 0.02);
            this.panner.positionY.setTargetAtTime(y, 0, 0.02);
            this.panner.positionZ.setTargetAtTime(z, 0, 0.02);
        }

        setOrientation(x: number, y: number, z: number) {
            this.panner.orientationX.setTargetAtTime(x, 0, 0.02);
            this.panner.orientationY.setTargetAtTime(y, 0, 0.02);
            this.panner.orientationZ.setTargetAtTime(z, 0, 0.02);
        }

        setCone(innerAngle: number, outerAngle: number, outerGain: number) {
            this.panner.coneInnerAngle = innerAngle;
            this.panner.coneOuterAngle = outerAngle;
            this.panner.coneOuterGain = outerGain;
        }

        setRollOff(refDistance: number, maxDistance: number, rolloffFactor: number) {
            this.panner.refDistance = refDistance;
            this.panner.maxDistance = maxDistance;
            this.panner.rolloffFactor = rolloffFactor;
        }

        setDistanceModel(model: DistanceModelValue) {
            switch (model) {
                case DistanceModelValue.Linear:
                    this.panner.distanceModel = "linear";
                    break;
                case DistanceModelValue.Inverse:
                    this.panner.distanceModel = "inverse";
                    break;
                case DistanceModelValue.Exponential:
                    this.panner.distanceModel = "exponential";
                    break;
            }
        }

        get x(): number { return this.panner.positionX.value; }
        get y(): number { return this.panner.positionY.value; }
        get z(): number { return this.panner.positionZ.value; }

        dispose() {
            this.panner.disconnect();
            this.panner = undefined;

            if (this.audioWorkletSource) {
                this.audioWorkletSource.dispose();
                this.audioWorkletSource = undefined;
            }

            const idx = SpatialAudioPlayer.allPlayers.indexOf(this);
            if (idx >= 0) SpatialAudioPlayer.allPlayers.splice(idx, 1);
        }

        async playInstructionsAsync(b: Uint8Array) {
            await AudioWorkletSource.initializeWorklet(this.context);

            if (!this.audioWorkletSource || this.audioWorkletSource.isDisposed()) {
                this.audioWorkletSource = new AudioWorkletSource(this.context, this.panner, true);
            }

            await this.audioWorkletSource.playInstructionsAsync(b);
        }
    }
}