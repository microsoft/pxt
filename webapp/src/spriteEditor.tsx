/// <reference path="../../built/pxtlib.d.ts" />
import * as React from 'react';
import * as sui from './sui';
import * as data from './data';

interface ISpriteEditorProps {
    input: pxt.SnippetQuestionInput;
    onChange: (v: string) => void;
    value: string;
    blocksInfo: pxtc.BlocksInfo;
    fullscreen?: boolean;
}

interface ISpriteEditorState {
    open: boolean;
}

export class SpriteEditor extends data.Component<ISpriteEditorProps, ISpriteEditorState> {
      constructor(props: ISpriteEditorProps) {
          super(props);
          this.state = {
            open: false,
          };

          this.openSpriteEditor = this.openSpriteEditor.bind(this);
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
          const { value, blocksInfo } = this.props;
          const stateSprite = value && this.stripImageLiteralTags(value);
          const state = pxtsprite
            .imageLiteralToBitmap('', stateSprite || DEFAULT_SPRITE_STATE);

          const contentDiv = this.refs['spriteEditorPopup'] as HTMLDivElement;

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

      openSpriteEditor() {
          this.setState({ open: true }, this.renderSpriteEditor);
      }

      renderEditor_() {
        const { fullscreen } = this.props;
        const { open } = this.state;

        if (fullscreen) {
            return (
                <sui.Modal
                    isOpen={open} size={'fullscreen'} basic={true} closeOnEscape={true} closeIcon={true}>
                    <div ref={'spriteEditorPopup'} />
                </sui.Modal>
            )
        }

        if (open) {
            return (
                <div className={'ui popup sprite-editor-snippet-popup'}>
                    <div className={'sprite-editor-popup'} ref={'spriteEditorPopup'}>
                    <div
                        className='sprite-editor-arrow blocklyDropDownArrow arrowTop'
                        style={{
                            transform: 'translate(242px, -9px) rotate(45deg)',
                        }}
                    />
                    </div>
                </div>
            );
        }

        return null;
      }

      renderCore() {

          return (
              <div>
                  <sui.Button
                      title={'Edit your sprite'}
                      size={'medium'}
                      onClick={this.openSpriteEditor}
                  >Edit your sprite</sui.Button>
                  {this.renderEditor_()}
              </div >
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