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

      /** The sprite editor input should be generalized somehow. Maybe have a "button" input that can be paired with embeddable custom types */
      openSpriteEditor() {
          this.setState({ open: true }, this.renderSpriteEditor);
      }


      renderCore() {
          const { fullscreen } = this.props;
          const { open } = this.state;

          const classes = sui.cx([
              'ui',
              fullscreen ? 'fullscreen modal sprite-editor-snippet-portal' : 'popup sprite-editor-snippet-popup',
            ]);

          return (
              <div className={fullscreen && 'ui fullscreen'}>
                  <sui.Button
                      title={'Edit your sprite'}
                      size={'medium'}
                      onClick={this.openSpriteEditor}
                  >Edit your sprite</sui.Button>
                  {open &&
                      <div className={fullscreen && classes}>
                          <div className={classes} ref={'spriteEditorPopup'}>
                            <div
                                className='sprite-editor-arrow blocklyDropDownArrow arrowTop'
                                style={{
                                    transform: 'translate(242px, -9px) rotate(45deg)',
                                }}
                            />
                          </div>
                      </div>
                  }
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