/// <reference path="../../built/pxtlib.d.ts" />
import * as React from 'react';
import * as sui from './sui';
import * as data from './data';
import { IQuestionInput } from './snippetBuilder';

interface ISpriteEditorProps {
    input: IQuestionInput;
    onChange: (v: string) => void;
    value: string;
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
          const { value } = this.props;
          const stateSprite = value && this.stripImageLiteralTags(value);
          const state = pxtsprite
            .imageLiteralToBitmap('', stateSprite || DEFAULT_SPRITE_STATE);

          const contentDiv = this.refs['spriteEditorPopup'] as HTMLDivElement;
          // TODO(jb) - This should be replaced with something real
          const blocksInfo = {
              apis: {
                  byQName: {},
              } as pxtc.ApisInfo,
          } as pxtc.BlocksInfo;

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
                .bitmapToImageLiteral(spriteEditor.bitmap(), pxt.editor.FileType.Text);
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
          const { open } = this.state;

          return (
              <div>
                  <sui.Button
                      title={'Edit your sprite'}
                      size={'medium'}
                      onClick={this.openSpriteEditor}
                  >Edit your sprite</sui.Button>
                  {open &&
                      <div id='spriteEditorPopupWrapper' className='ui popup sprite-editor-snippet-popup'>
                          <div id='spriteEditorPopup' ref={'spriteEditorPopup'}>
                              <div id='snippetBuilderTopArrow' className='blocklyDropDownArrow arrowTop' style={{ transform: 'translate(242px, -9px) rotate(45deg)' }} />
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