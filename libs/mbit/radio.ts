//% color=270 weight=90
namespace radio {
    /**
     * Sends a message id to other micro:bit in the group using radio.
     * {namespace:radio}
     * {weight:80}
     * {help:/functions/broadcast-message}
     * {shim:micro_bit::broadcastMessage}
     */
    //% blockId=radio_broadcast block="broadcast message %MESSAGE" icon="\uf1d8" blockGap=12
    export function broadcastMessage(message: number) : void
    {
        /*
        if (message < 0 || message > 65325) {
            simulator.warning("message should be between 0 and 65535.");
        }
        noBleWarning();
        */
    }

    /**
     * Registers code to run when a particular message is received from another micro:bit.
     * {namespace:radio}
     * {weight:79}
     * {help:/functions/on-message-received}
     * {shim:micro_bit::onBroadcastMessageReceived}
     */
    //% blockId=radio_broadcast_received_event block="on message received" icon="\uf1d8"
    export function onMessageReceived(message: number, body:Action) : void
    {
        /*
        if (message < 0 || message > 65325) {
            TD.simulator.warning("message should be between 0 and 65535.");
        }
        noBleWarning();
        */
    }

    /**
     * Broadcasts a number over radio to any connected micro:bit in the group.
     * {help:/functions/send-number}
     * {namespace:radio}
     * {shim:micro_bit::datagramSendNumber}
     * {weight:78}
     */
    //% blockId=radio_datagram_send block="send number %MESSAGE" blockGap=8
    export function sendNumber(value: number) : void {
    }

    /**
     * Reads the next packet as a number from the radio queue.
     * {help:/functions/receive-number}
     * {weight:77}
     * {namespace:radio}
     * {shim:micro_bit::datagramReceiveNumber}
     */
    //% blockId=radio_datagram_receive block="receive number"
    export function receiveNumber() : number
    {
        //noBleWarning();
        return 0;
    }

    /*
    function noBleWarning() : void
    {
        if (TD.simulator.isBleRequired()) {
            TD.simulator.warning("*radio* functions cannot be used with *devices* function or BLE enabled");
        }
    }*/

    /**
     * Registers code to run when a packet is received over radio.
     * {namespace:radio}
     * {weight:30}
     * {help:/functions/on-data-received}
     * {shim:micro_bit::onDatagramReceived}
     */
    //% blockId=radio_datagram_received_event block="on data received"
    export function onDataReceived(body:Action) : void
    {
  //      noBleWarning();
    }

    /**
     * Broadcasts 4 numbers over radio to any connected micro:bit in the group.
     * {help:/functions/send-numbers}
     * {namespace:radio}
     * {shim:micro_bit::datagramSendNumbers}
     * {weight:20}
     */
    //% blockId=radio_datagram_send_numbers block="send numbers|0: %VALUE0|1: %VALUE1|2: %VALUE2|3: %VALUE3" blockGap=8
    export function sendNumbers(value_0: number, value_1: number, value_2: number, value_3: number) : void
    {
//        noBleWarning();
    }

    /**
     * Reads a number at a given index, between ``0`` and ``3``, from the packet received by ``receive number``. Not supported in simulator.
     * {namespace:radio}
     * {help:/functions/received-number-at}
     * {weight:19}
     * {shim:micro_bit::datagramGetNumber}
     * {hints:index:0,1,2,3}
     */
    //% blockId=radio_datagram_received_number_at block="receive number|at %VALUE" blockGap=8
    export function receivedNumberAt(index: number) : number {
  /*      if (index < 0 || index >= 4) {
            TD.simulator.warning("index should be between ``0`` and ``3``.");
        }*/
        return 0;
    }

    /**
     * Gets the received signal strength indicator (RSSI) from the packet received by ``receive number``. Not supported in simulator.
     * {namespace:radio}
     * {help:/functions/received-signal-strength}
     * {weight:10}
     * {shim:micro_bit::datagramGetRSSI}
     * {weight:18}
     */
    //% blockId=radio_datagram_rssi block="received signal strength"
    export function receivedSignalStrength() : number
    {
        return 0;
    }

    /**
     * Sets the group id for radio communications. A micro:bit can only listen to one group ID at any time.
     * @ param id the group id between ``0`` and ``255``, eg: 1
     * {namespace:radio}
     * {weight:10}
     * {help:/functions/set-group}
     * {shim:micro_bit::setGroup}
     */
    //% blockId=radio_set_group block="set group %ID"
    export function setGroup(id: number) : void
    {
        /*
        if (id < 0 || id > 255) {
            TD.simulator.warning("id should be between 0 and 255.");
        }
        noBleWarning();
        */
    }
}