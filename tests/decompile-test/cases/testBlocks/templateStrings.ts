declare interface Image {
    /**
     * Get a pixel color
     */
    //% shim=ImageMethods::get
    get(x: number, y: number): number;
}

//% fixedInstances
declare interface Fixed {
    whatever(): void;
}

//% shim=@f4 helper=image::ofBuffer
//% groups=["0.","1#","2T","3t","4N","5n","6G","7g","8","9","aAR","bBP","cCp","dDO","eEY","fFW"]
function img(lits: any, ...args: any[]): Image { return null }

//% shim=@f4 helper=image::ofBuffer
//% groups=["0.","1#","2T","3t","4N","5n","6G","7g","8","9","aAR","bBP","cCp","dDO","eEY","fFW"]
function badt(lits: any, ...args: any[]): Image { return null }

//% shim=@f4 helper=image::ofBuffer blockIdentity="template.imageEditor"
//% groups=["0.","1#","2T","3t","4N","5n","6G","7g","8","9","aAR","bBP","cCp","dDO","eEY","fFW"]
function withID(lits: any, ...args: any[]): Image { return null }

//% shim=@f4 helper=image::ofBuffer blockIdentity="template.fixShim"
//% groups=["0.","1#","2T","3t","4N","5n","6G","7g","8","9","aAR","bBP","cCp","dDO","eEY","fFW"]
function fix(lits: any, ...args: any[]): Fixed { return null }

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

    /**
     * Image editor...
     * @param img the iamge
     */
    //% blockId=imageeditor block="%img" shim=TD_ID
    //% img.fieldEditor="gridpicker"
    //% img.fieldOptions.taggedTemplate="img"
    export function imageEditor(img: Image): Image {
        return img;
    }


    /**
     * Image editor...
     * @param img the iamge
     */
    //% blockId=imageeditor2 block="%img" shim=TD_ID
    //% img.fieldEditor="gridpicker"
    //% img.fieldOptions.taggedTemplate="img"
    export function imageEditor2(img: Image): Image {
        return img;
    }

    /**
     * Image editor...
     * @param img the iamge
     */
    //% blockId=nofieldeditor_template block="%img"
    export function noFieldEditorTemplate(img: Image): void {

    }

    /**
     * Image editor...
     * @param img the iamge
     */
    //% blockId=shadow_template block="%img=imageeditor"
    export function shadowBlockTemplate(img: Image): void {

    }


    /**
     * Image editor...
     * @param img the iamge
     */
    //% blockId=shadow_template2 block="%img=imageeditor2"
    export function shadowBlockTemplate2(img: Image): void {

    }

    /**
     * Image editor...
     * @param img the iamge
     */
    //% blockId=fixshim block="%img" shim=TD_ID
    //% img.fieldEditor="gridpicker"
    //% img.fieldOptions.taggedTemplate="fix"
    //% img.fieldOptions.decompileIndirectFixedInstances="true"
    export function fixShim(f: Fixed): Fixed {
        return f;
    }

    //% blockId=shadow_fixed_template block="%img=fixshim"
    export function fixedInstanceArg(fix: Fixed): void {

    }
}