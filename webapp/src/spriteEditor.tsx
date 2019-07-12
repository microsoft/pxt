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
    firstRender: boolean;
}

export class SpriteEditor extends data.Component<ISpriteEditorProps, ISpriteEditorState> {
    private blocksInfo: pxtc.BlocksInfo;
    private spriteEditor: pxtsprite.SpriteEditor;

    constructor(props: ISpriteEditorProps) {
        super(props);
        this.state = {
            firstRender: true,
        };

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

    updateSpriteState() {
        const newSpriteState = pxtsprite
            .bitmapToImageLiteral(this.spriteEditor.bitmap().image, pxt.editor.FileType.Text);

        this.props.onChange(newSpriteState);
    }

    componentWillUnmount() {
        this.updateSpriteState();
    }

    renderSpriteEditor() {
        const { blocksInfo, props } = this;
        const { value } = props;

        const stateSprite = value && this.stripImageLiteralTags(value);
        const state = pxtsprite
            .imageLiteralToBitmap('', stateSprite || DEFAULT_SPRITE_STATE);

        const contentDiv = this.refs['spriteEditorContainer'] as HTMLDivElement;

        this.spriteEditor = new pxtsprite.SpriteEditor(state, blocksInfo, false);
        this.spriteEditor.render(contentDiv);
        this.spriteEditor.rePaint();
        if (this.state.firstRender) {
            this.spriteEditor.setActiveColor(1, true);
        }
        this.spriteEditor.setSizePresets([
            [8, 8],
            [16, 16],
            [32, 32],
            [10, 8]
        ]);

        contentDiv.style.height = (this.spriteEditor.outerHeight() + 3) + "px";
        contentDiv.style.width = (this.spriteEditor.outerWidth() + 3) + "px";
        contentDiv.style.overflow = "hidden";
        contentDiv.className = 'sprite-editor-dropdown-bg sprite-editor-dropdown';
        this.spriteEditor.addKeyListeners();
        this.spriteEditor.onClose(() => {
            this.updateSpriteState();
            this.spriteEditor.removeKeyListeners();
            this.setState({ firstRender: false })
            // Dangerously set for now
            contentDiv.innerHTML = '';
            this.renderSpriteEditor();
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