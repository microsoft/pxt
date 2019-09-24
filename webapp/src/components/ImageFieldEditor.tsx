import * as React from "react";

import { FieldEditorComponent } from '../blocklyFieldView';
import { ImageEditor } from "./ImageEditor/ImageEditor";

export interface ImageFieldEditorState {
    galleryVisible: boolean;
}

export class ImageFieldEditor extends React.Component<{}, ImageFieldEditorState> implements FieldEditorComponent {
    constructor(props: {}) {
        super(props);

        this.state = {
            galleryVisible: false
        };
    }
    render() {
        return <div className="image-editor-wrapper">
            <div className="gallery-editor-header">
                <div className={`gallery-editor-toggle ${this.state.galleryVisible ? "right" : "left"}`} onClick={this.toggleGallery}>
                    <div className="gallery-editor-toggle-label gallery-editor-toggle-left">
                        {lf("Editor")}
                    </div>
                    <div className="gallery-editor-toggle-label gallery-editor-toggle-right">
                        {lf("Gallery")}
                    </div>
                    <div className="gallery-editor-toggle-handle"/>
                </div>
            </div>
            <div className="image-editor-content">
                <ImageEditor ref="image-editor" />
            </div>
        </div>
    }


    init(value: string, options?: any) {
        if (this.refs["image-editor"]) {
            (this.refs["image-editor"] as ImageEditor).init(value, options);
        }
    }

    getValue() {
        if (this.refs["image-editor"]) {
            return (this.refs["image-editor"] as ImageEditor).getValue();
        }
        return "";
    }

    getPersistentData() {
        if (this.refs["image-editor"]) {
            return (this.refs["image-editor"] as ImageEditor).getPersistentData();
        }

        return null;
    }

    restorePersistentData(oldValue: any) {
        if (this.refs["image-editor"]) {
            (this.refs["image-editor"] as ImageEditor).restorePersistentData(oldValue);
        }
    }

    protected toggleGallery = () => {
        this.setState({
            galleryVisible: !this.state.galleryVisible
        })
    }
}