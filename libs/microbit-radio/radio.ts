//% color=270 weight=34
namespace radio {
    /**
     * Sends a message id to other micro:bit in the group using radio.
     */
    //% weight=70 shim="micro_bit::broadcastMessage" help="/functions/broadcast-message"
    //% blockId=radio_broadcast block="broadcast message %MESSAGE" icon="\uf1d8" blockGap=12
    export function broadcastMessage(message: number) : void {
        /*
        if (message < 0 || message > 65325) {
            simulator.warning("message should be between 0 and 65535.");
        }
        noBleWarning();
        */
    }

    /**
     * Registers code to run when a particular message is received from another micro:bit.
     */
    //% help=/functions/on-message-received
    //% shim=micro_bit::onBroadcastMessageReceived
    //% weight=69
    //% blockId=radio_broadcast_received_event block="on message received %message" icon="\uf1d8"
    export function onMessageReceived(message: number, body:Action) : void {
        /*
        if (message < 0 || message > 65325) {
            TD.simulator.warning("message should be between 0 and 65535.");
        }
        noBleWarning();
        */
    }

    /**
     * Broadcasts a number over radio to any connected micro:bit in the group.
     */    
    //% help=/functions/send-number
    //% shim=micro_bit::datagramSendNumber
    //% weight=60
    //% blockId=radio_datagram_send block="send number %MESSAGE" blockGap=8
    export function sendNumber(value: number) : void { }

    /**
     * Reads the next packet as a number from the radio queue.
     */
    //% help=/functions/receive-number
    //% shim=micro_bit::datagramReceiveNumber
    //% weight=59
    //% blockId=radio_datagram_receive block="receive number" blockGap=12
    export function receiveNumber() : number
        {
        //noBleWarning();
        return 0;
    }

    /**
     * Registers code to run when a packet is received over radio.
     */
    //% help=/functions/on-data-received
    //% shim=micro_bit::onDatagramReceived
    //% weight=58
    //% blockId=radio_datagram_received_event block="on data received" blockGap=8
    export function onDataReceived(body:Action) : void
        {
        //      noBleWarning();
    }

    /**
     * Broadcasts 4 numbers over radio to any connected micro:bit in the group.
     */
    //% help=/functions/send-numbers
    //% shim=micro_bit::datagramSendNumbers
    //% weight=57
    //% blockId=radio_datagram_send_numbers block="send numbers|0: %VALUE0|1: %VALUE1|2: %VALUE2|3: %VALUE3" blockGap=8
    export function sendNumbers(value_0: number, value_1: number, value_2: number, value_3: number) : void
        {
        //        noBleWarning();
    }

    /**
     * Reads a number at a given index, between ``0`` and ``3``, from the packet received by ``receive number``. Not supported in simulator.
     */
    //% help=/functions/received-number-at
    //% shim=micro_bit::datagramGetNumber
    //% hints=index:0,1,2,3
    //% weight=56
    //% blockId=radio_datagram_received_number_at block="receive number|at %VALUE" blockGap=8
    export function receivedNumberAt(index: number) : number {
        /*      if (index < 0 || index >= 4) {
            TD.simulator.warning("index should be between ``0`` and ``3``.");
        }*/
        return 0;
    }

    /**
     * Gets the received signal strength indicator (RSSI) from the packet received by ``receive number``. Not supported in simulator.
     * namespace=radio
     */
    //% help=/functions/received-signal-strength
    //% shim=micro_bit::datagramGetRSSI
    //% weight=55
    //% blockId=radio_datagram_rssi block="received signal strength"
    export function receivedSignalStrength() : number {
        return 0;
    }

    /**
     * Sets the group id for radio communications. A micro:bit can only listen to one group ID at any time.
     * @ param id the group id between ``0`` and ``255``, eg: 1
     */
    //% help=/functions/set-group
    //% shim=micro_bit::setGroup
    //% weight=10
    //% blockId=radio_set_group block="set group %ID"
    export function setGroup(id: number) : void {
    }
}
