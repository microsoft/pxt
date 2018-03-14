declare interface Image {    
    /**
     * Get a pixel color
     */
    //% shim=ImageMethods::get
    get(x: number, y: number): number;
}

//% shim=@f4 helper=image::ofBuffer
//% groups=["0.","1#","2T","3t","4N","5n","6G","7g","8","9","aAR","bBP","cCp","dDO","eEY","fFW"]
function img(lits: any, ...args: any[]): Image { return null }

//% shim=@f4 helper=image::ofBuffer
//% groups=["0.","1#","2T","3t","4N","5n","6G","7g","8","9","aAR","bBP","cCp","dDO","eEY","fFW"]
function badt(lits: any, ...args: any[]): Image { return null }

namespace template {

    /**
     * Creates a new sprite from an image
     * @param img the iamge
     */
    //% blockId=spritescreate block="create %img"
    //% img.fieldEditor="gridpicker"
    //% img.fieldOptions.taggedTemplate="img"
    export function create(img: Image): number {
        return 0
    }
}