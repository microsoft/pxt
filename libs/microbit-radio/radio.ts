//% color=270 weight=34
namespace radio {
    /**
     * Broadcasts a number over radio to any connected micro:bit in the group.
     */    
    //% help=/functions/send-number
    //% weight=60
    //% blockId=radio_datagram_send block="send number %MESSAGE" blockGap=8
    export function sendNumber(value: number) : void { 
        sendNumbers(value, 0, 0, 0);
    }

    /**
     * Broadcasts 4 numbers over radio to any connected micro:bit in the group.
     */
    //% help=/functions/send-numbers
    //% shim=micro_bit::datagramSendNumbers
    //% weight=59
    //% blockId=radio_datagram_send_numbers block="send numbers|0: %VALUE0|1: %VALUE1|2: %VALUE2|3: %VALUE3"
    export function sendNumbers(value_0: number, value_1: number, value_2: number, value_3: number) : void {
        //        noBleWarning();
    }

    /**
     * Registers code to run when a packet is received over radio.
     */
    //% help=/functions/on-data-received
    //% shim=micro_bit::onDatagramReceived
    //% weight=50
    //% blockId=radio_datagram_received_event block="on data received" blockGap=8
    export function onDataReceived(body:Action) : void {
        //      noBleWarning();
    }

    /**
     * Reads the next packet as a number from the radio queue.
     */
    //% help=/functions/receive-number
    //% shim=micro_bit::datagramReceiveNumber
    //% weight=46
    //% blockId=radio_datagram_receive block="receive number" blockGap=8
    export function receiveNumber() : number
        {
        //noBleWarning();
        return 0;
    }

    /**
     * Reads a number at a given index, between ``0`` and ``3``, from the packet received by ``receive number``. Not supported in simulator.
     * @param index index of the number to read from 0 to 3. eg: 1
     */
    //% help=/functions/received-number-at
    //% shim=micro_bit::datagramGetNumber
    //% weight=45
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
    //% weight=40
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
