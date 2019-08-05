/// <reference path="../../built/pxtlib.d.ts" />
import * as React from 'react';
import * as sui from './sui';
import * as data from './data';
import * as compiler from './compiler';

const SPRITE_EDITOR_DEFAULT_HEIGHT = 1023;
const SPRITE_EDITOR_DEFAULT_WIDTH = 2100;

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
        this.cleanupSpriteEditor = this.cleanupSpriteEditor.bind(this);
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

    protected setScale() {
        // Sprite editor default height at scale 1 1023 - full size value
        const height = window.innerHeight;
        // Sprite editor default height at scale 1 2100 - full size value
        const width = window.innerWidth;

        let scale = height > width ? width / SPRITE_EDITOR_DEFAULT_WIDTH : height / SPRITE_EDITOR_DEFAULT_HEIGHT;

        // Minimum resize threshold .81
        if (scale < .61) {
            scale = .61;
        }
        // Maximum resize threshhold
        else if (scale > 1) {
            scale = 1;
        }

        // Set new scale and reset sprite editor
        this.setState({ scale }, () => {
            // Ensure that sprite editor has mounted
            if (this.spriteEditor) {
                this.cleanupSpriteEditor();
            }
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

        // Sprite editor container
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
        this.spriteEditor.onClose(this.cleanupSpriteEditor);
    }

    protected removeChildrenInNode(node: HTMLDivElement) {
        while (node.hasChildNodes()) {
            node.removeChild(node.lastChild);
        }
    }

    protected cleanupSpriteEditor = pxt.Util.debounce(() => {
        // Sprite editor container
        const contentDiv = this.refs['spriteEditorContainer'] as HTMLDivElement;

        this.updateSpriteState();
        this.spriteEditor.removeKeyListeners();

        this.setState({
            firstRender: false,
            spriteEditorActiveColor: this.spriteEditor.color,
        });

        this.removeChildrenInNode(contentDiv);
        this.spriteEditor = undefined;
        this.renderSpriteEditor();
    }, 500)

    public renderCore() {
        const { scale } = this.state;

        return (
            <div className='snippet-sprite-editor'>
                <div
                    className={'sprite-editor-snippet-container'}
                    ref={'spriteEditorContainer'}
                    id={'snippetBuilderSpriteEditorContainer'}
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