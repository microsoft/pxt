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
    spriteEditorActiveColor: number;
    scale?: number;
}

export class SpriteEditor extends data.Component<ISpriteEditorProps, ISpriteEditorState> {
    private blocksInfo: pxtc.BlocksInfo;
    private spriteEditor: pxtsprite.SpriteEditor;

    constructor(props: ISpriteEditorProps) {
        super(props);
        this.state = {
            firstRender: true,
            spriteEditorActiveColor: 3,
        };

        this.setScale = this.setScale.bind(this);
    }

    protected setScale() {
        // 1023 - full size value
        const height = window.innerHeight;
        // 2100 - full size value
        const width = window.innerWidth;

        let scale = height > width ? width / 2100 : height / 1003;

        // Minimum resize threshold
        if (scale < .81) {
            scale = .81;
        }
        // Maximum resize threshhold
        else if (scale > 1.02) {
            scale = 1.02;
        }

        this.setState({ scale });
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.setScale);
        this.updateSpriteState();
    }

    componentDidMount() {
        // Run once to set initial scale
        this.setScale();
        window.addEventListener('resize', this.setScale);
        // Fetches blocksInfo for sprite editor
        compiler
            .getBlocksAsync()
            .then((blocksInfo) => {
                this.blocksInfo = blocksInfo;
                this.renderSpriteEditor();
            });
    }

    protected stripImageLiteralTags(imageLiteral: string) {
        const imgTag = `img\``;
        const endQuote = `\``;
        if (imageLiteral.includes(imgTag)) {
            return imageLiteral
                .replace(imgTag, '')
                .replace(endQuote, '')
        }

        return imageLiteral;
    }

    protected updateSpriteState() {
        const newSpriteState = pxtsprite
            .bitmapToImageLiteral(this.spriteEditor.bitmap().image, pxt.editor.FileType.Text);

        this.props.onChange(newSpriteState);
    }

    protected renderSpriteEditor() {
        const { spriteEditorActiveColor, scale } = this.state;
        const { blocksInfo, props } = this;
        const { value } = props;

        const stateSprite = value && this.stripImageLiteralTags(value);
        const state = pxtsprite
            .imageLiteralToBitmap('', stateSprite || DEFAULT_SPRITE_STATE);

        const contentDiv = this.refs['spriteEditorContainer'] as HTMLDivElement;

        this.spriteEditor = new pxtsprite.SpriteEditor(state, blocksInfo, false, scale);
        this.spriteEditor.render(contentDiv);
        this.spriteEditor.rePaint();
        // this.spriteEditor.setActiveColor(spriteEditorActiveColor, true);
        this.spriteEditor.color = spriteEditorActiveColor;
        this.spriteEditor.setSidebarColor(spriteEditorActiveColor);
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

            this.setState({
                firstRender: false,
                spriteEditorActiveColor: this.spriteEditor.color,
            });

            // Dangerously set for now
            contentDiv.innerHTML = '';
            this.spriteEditor = undefined;
            this.renderSpriteEditor();
        });
    }

    public renderCore() {
        const { scale } = this.state;
        return (
            <div className='snippet-sprite-editor'>
                <div
                    className={'sprite-editor-snippet-container'}
                    ref={'spriteEditorContainer'}
                    style={{
                        transformOrigin: `0 0`,
                        transform: `scale(${scale})`,
                    }}
                />
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