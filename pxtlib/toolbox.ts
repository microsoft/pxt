namespace pxt.toolbox {
    export const blockColors: Map<number | string> = {
        loops: '#107c10',
        logic: '#006970',
        math: '#712672',
        images: '#5C2D91',
        variables: '#A80000',
        functions: '#005a9e',
        text: '#996600',
        arrays: '#A94400',
        advanced: '#3c3c3c'
    }

    export const blockIcons: Map<number | string> = {
        loops: '\uf01e',
        logic: '\uf074',
        math: '\uf1ec',
        variables: '\uf039',
        functions: '\uf109',
        text: '\uf035',
        arrays: '\uf0cb'
    }

    export enum CategoryMode {
        All,
        None,
        Basic
    }

    let toolboxStyle: HTMLStyleElement;
    let toolboxStyleBuffer: string = '';
    export function appendToolboxIconCss(className: string, i: string): void {
        if (toolboxStyleBuffer.indexOf(className) > -1) return;

        if (i.length === 1) {
            const icon = Util.unicodeToChar(i);
            toolboxStyleBuffer += `
                .blocklyTreeIcon.${className}::before {
                    content: "${icon}";
                }
            `;
        }
        else {
            toolboxStyleBuffer += `
                .blocklyTreeIcon.${className} {
                    background-image: url("${Util.pathJoin(pxt.webConfig.commitCdnUrl, encodeURI(i))}")!important;
                    width: 30px;
                    height: 100%;
                    background-size: 20px !important;
                    background-repeat: no-repeat !important;
                    background-position: 50% 50% !important;
                }
            `;
        }
    }

    export function injectToolboxIconCss(extraCss?: string): void {
        if (extraCss)
            toolboxStyleBuffer += extraCss;

        if (!toolboxStyle) {
            toolboxStyle = document.createElement('style');
            toolboxStyle.id = "blocklyToolboxIcons";
            toolboxStyle.type = 'text/css';
            let head = document.head || document.getElementsByTagName('head')[0];
            head.appendChild(toolboxStyle);
        }

        if (toolboxStyle.sheet) {
            toolboxStyle.textContent = toolboxStyleBuffer + namespaceStyleBuffer;
        } else {
            toolboxStyle.appendChild(document.createTextNode(toolboxStyleBuffer + namespaceStyleBuffer));
        }
    }

    let namespaceStyleBuffer: string = '';
    export function appendNamespaceCss(namespace: string, color: string) {
        const ns = namespace.toLowerCase();
        color = color || '#dddddd'; // Default toolbox color
        if (namespaceStyleBuffer.indexOf(ns) > -1) return;
        namespaceStyleBuffer += `
            span.docs.${ns} {
                background-color: ${color} !important;
                border-color: ${Blockly.PXTUtils.fadeColour(color, 0.2, true)} !important;
            }
        `;
    }
}