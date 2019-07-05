/// <reference path="../../built/pxtlib.d.ts" />
import * as React from 'react';
import * as sui from './sui';
import * as data from './data';
import * as compiler from './compiler';

interface ISpriteEditorProps {
    input: pxt.SnippetQuestionInput;
    onChange: (v: string) => void;
    value: string;
    fullscreen?: boolean;
}

interface ISpriteEditorState {
    open: boolean;
}

export class SpriteEditor extends data.Component<ISpriteEditorProps, ISpriteEditorState> {
    private blocksInfo: pxtc.BlocksInfo;

    constructor(props: ISpriteEditorProps) {
        super(props);

        // Fetches blocksInfo for sprite editor
        compiler
            .getBlocksAsync()
            .then((blocksInfo) => this.blocksInfo = blocksInfo);
    }

    stripImageLiteralTags(imageLiteral: string) {
        const imgTag = `img\``;
        const endQuote = `\``;
        if (imageLiteral.includes(imgTag)) {
            return imageLiteral
                .replace(imgTag, '')
                .replace(endQuote, '')
        }

        return imageLiteral;
    }

    renderSpriteEditor() {
        const { blocksInfo, props } = this;
        const { value } = props;

        const stateSprite = value && this.stripImageLiteralTags(value);
        const state = pxtsprite
        .imageLiteralToBitmap('', stateSprite || DEFAULT_SPRITE_STATE);

        const contentDiv = this.refs['spriteEditorContainer'] as HTMLDivElement;

        let spriteEditor = new pxtsprite.SpriteEditor(state, blocksInfo, false);
        spriteEditor.render(contentDiv);
        spriteEditor.rePaint();
        spriteEditor.setActiveColor(1, true);
        spriteEditor.setSizePresets([
            [8, 8],
            [16, 16],
            [32, 32],
            [10, 8]
        ]);

        contentDiv.style.height = (spriteEditor.outerHeight() + 3) + "px";
        contentDiv.style.width = (spriteEditor.outerWidth() + 3) + "px";
        contentDiv.style.overflow = "hidden";
        contentDiv.className = 'sprite-editor-dropdown-bg sprite-editor-dropdown';
        spriteEditor.addKeyListeners();
        spriteEditor.onClose(() => {
            const newSpriteState = pxtsprite
            .bitmapToImageLiteral(spriteEditor.bitmap().image, pxt.editor.FileType.Text);
            this.setState({
                open: false,
            });
            spriteEditor.removeKeyListeners();
            this.props.onChange(newSpriteState);
            spriteEditor = undefined;
        });
    }

    componentDidMount() {
        this.renderSpriteEditor();
    }

    renderCore() {

    return (
        <div className='snippet-sprite-editor'>
            <div className={'sprite-editor-snippet-container'} ref={'spriteEditorContainer'} />
        </div>
    );
    }
  }

const DEFAULT_SPRITE_STATE = `
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
`;