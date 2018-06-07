enum  Gesture {
    //% block="shake"
    Shake, 
    //% block="tilt up"
    TiltUp, 
    //% block="tilt down"
    TiltDown,
    //% block="tilt left"
    TiltLeft, 
    //% block="tilt right"
    TiltRight, 
    //% block="face up"
    FaceUp, 
    //% block="face down"
    FaceDown, 
    //% block="free fall"
    FreeFall 

}

namespace sample {

    //% block
    //% gesture.fieldEditor="gridpicker"
    //% gesture.fieldOptions.width=220
    //% gesture.fieldOptions.columns=3
    export function onGesture(gesture: Gesture) {

    }

}