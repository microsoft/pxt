/// <reference path="../../built/pxtsim.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"
import * as core from "./core";

export interface LogViewState {
    stream?: pxt.streams.JsonStream;
}

export class LogView extends React.Component<{}, LogViewState> {
    private view: pxsim.logs.LogViewElement;
    private streamUploader = 0;

    constructor(props: any) {
        super(props);
        this.view = new pxsim.logs.LogViewElement({
            maxEntries: 80,
            maxAccValues: 500,
            onClick: (es) => this.onClick(es)
        })
        this.state = {};
    }

    componentDidMount() {
        let node = ReactDOM.findDOMNode(this);
        node.appendChild(this.view.element);
    }

    clear() {
        this.view.clear();
    }

    render() {
        return <div/>
    }

    componentDidUpdate() {
        if (this.state.stream)
            this.scheduleStreamData();
    }
    
    private lastStreamUpload = 0;
    private scheduleStreamData = Util.debounce(() => {
        let stream = this.state.stream;
        if (!stream) return;

        console.log('streaming payload...')
        let data = this.view.streamPayload(this.lastStreamUpload);     
        this.lastStreamUpload = Util.now();
        let p = data
            ? pxt.streams.postPayloadAsync(stream, data)
            : Promise.resolve();
        p.done(() => this.scheduleStreamData());        
    }, 1000, true);

    setStream(stream: pxt.streams.JsonStream) {
        this.setState({ stream: stream });
    }

    onClick(entries: pxsim.logs.ILogEntry[]) {
        const targetTheme = pxt.appTarget.appTheme;

        core.confirmAsync({
            logos: [targetTheme.logo],
            header: pxt.appTarget.title + ' - ' + lf("Analyze Data"),
            hideAgree: true,
            disagreeLbl: lf("Close"),
            onLoaded: (_) => {
                _.find('#datasavelocalfile').click(() => {
                    _.modal('hide');
                    pxt.commands.browserDownloadAsync(pxsim.logs.entriesToCSV(entries), "data.csv", 'text/csv')
                }),
                _.find('#datastream').click(() => {
                    _.modal('hide');
                    if (this.state.stream)
                        this.setStream(null);
                    else pxt.streams.createStreamAsync().done(stream => {
                        this.setStream(stream);
                    })
                })                
            },
            htmlBody: `
<div class="ui two column grid">
  <div class="column">
    <div id="datasavelocalfile" class="ui fluid card link">
        <div class="ui image">
        </div>
        <div class="content">
            <div class="header">${lf("Local File")}</div>
            <div class="description">
                ${lf("Save the data to your local Downloads folder.")}
            </div>
        </div>
        <div class="ui bottom attached button">
            <i class="download icon"></i>
            Download data
        </div>        
    </div>
  </div>
  <div class="column">
    <div id="datastream" class="ui fluid card link">
        <div class="ui image">
        </div>
        <div class="content">
            <div class="header">${lf("Stream to Microsoft Azure")}</div>
            <div class="description">
                ${lf("Upload your data to the cloud.")}
            </div>
        </div>
        <div class="ui bottom attached button">
            <i class="${this.state.stream ? "stop" : "play"} icon"></i>
            ${this.state.stream ? lf("Stop streaming") : lf("Start streaming")}
        </div>        
    </div>
  </div>
</div>`
        }).done();
    }
}