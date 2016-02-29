import * as React from "react";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as sui from "./sui";
import * as codecard from "./codecard"

import Cloud = yelm.Cloud;
import Util = yelm.Util;

var lf = Util.lf

export class Editor extends srceditor.Editor {
    config: yelm.PackageConfig = {} as any;

    prepare() {
        this.isReady = true
    }

    getId() {
        return "yelmjsonEditor"
    }

    display() {
        let c = this.config
        let update = (v: any) => {
            this.parent.forceUpdate()
            Util.nextTick(this.changeCallback)
        }
        let initCard = () => {
            if (!c.card) c.card = {}
        }
        let card = c.card || {};
        let mainFile = pkg.mainEditorPkg().getMainFile();
                
        return (
            <div className="ui four column grid">
                <div className="ui column">
                    <div className="ui segment">                    
                        <codecard.CodeCard 
                            url="yelm.io/abc" 
                            header="me" 
                            name={c.name}
                            description={c.description} 
                            card={c.card} 
                            />
                    </div>
                </div>
                <div className="ui three column">
                    <div className="ui segment form text container" style={{backgroundColor: "white"}}>
                        <sui.Field>
                            <div className="ui toggle checkbox ">
                                <input type="checkbox" name="public" checked={c.public}
                                    onChange={() => update(c.public = !c.public) } />
                                <label>{lf("Public package (library)") }</label>
                            </div>
                        </sui.Field>
                        <sui.Input label={lf("Name") } value={c.name} onChange={v => update(c.name = v) } />
                        <sui.Input label={lf("Description") } lines={3} value={c.description} onChange={v => update(c.description = v) } />
                        <sui.Input label={lf("Picture or video (YouTube, Vimeo, Instagram)")} value={card.promoUrl || ""} onChange={v => {
                            initCard();
                            update(c.card.promoUrl = v)
                        }} />
                        <div className="three fields">
                        <sui.Input inputLabel={lf("Any")} type="number" value={(card.any || 0).toString()} onChange={v => {
                            initCard();
                            let vi = Math.max(0, parseInt(v) || 0)
                            update(c.card.any = vi)
                        }} />
                        <sui.Input inputLabel={lf("Hardware")} type="number" value={(card.hardware || 0).toString()} onChange={v => {
                            initCard();
                            let vi = Math.max(0, parseInt(v) || 0)
                            update(c.card.hardware = vi)
                        }} />
                        <sui.Input inputLabel={lf("Software")} type="number" value={(card.software || 0).toString()} onChange={v => {
                            initCard();
                            let vi = Math.max(0, parseInt(v) || 0)
                            update(c.card.software = vi)
                        }} />
                        </div>
                        <div className="two fields">
                        <sui.Input inputLabel={lf("Power")} type="number" value={(card.power || 0).toString()} onChange={v => {
                            initCard();
                            let vi = Math.max(0, parseInt(v) || 0)
                            update(c.card.power = vi)
                        }} /> /
                        <sui.Input inputLabel={lf("Toughness")} type="number" value={(card.toughness || 0).toString()} onChange={v => {
                            initCard();
                            let vi = Math.max(0, parseInt(v) || 0)
                            update(c.card.toughness = vi)
                        }} />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    getCurrentSource() {
        return JSON.stringify(this.config, null, 4) + "\n"
    }

    acceptsFile(file: pkg.File) {
        if (file.name != yelm.configName) return false
        
        if (file.isReadonly()) {
            // TODO add read-only support
            return false
        }

        try {
            let cfg = JSON.parse(file.content)
            // TODO validate?
            return true;
        } catch (e) {
            return false;
        }
    }

    loadFile(file: pkg.File) {
        this.config = JSON.parse(file.content)
        this.setDiagnostics(file)
    }
    
    menu() {
        return (
            <div className="item">
                <sui.Button class="button floating" text={lf("Edit Text") } icon="keyboard" onClick={() => this.parent.editText() } />
            </div>
        )        
    }
}
