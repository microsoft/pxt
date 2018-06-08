/**
 * Use weights to control the order of blocks, higher weight means higher in the toolbox
 */
//% color="#AA278D"
namespace blocks {
    /**
     * This block goes to the bottom
     */
    //% block
    //% weight=50
    export function second() {
    }

    /**
     * This block goes on top
     */
    //% block
    //% weight=100
    export function first() {

    }
}