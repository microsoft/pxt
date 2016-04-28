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

    private lastStreamUploadTime = 0;
    private streamUploadTimeout = 0;

    private cancelStreamData() {
        if (this.streamUploadTimeout) {
            clearTimeout(this.streamUploadTimeout);
            this.streamUploadTimeout = 0;
        }
    }

    private scheduleStreamData() {
        this.cancelStreamData();
        let towait = Math.max(100, 5000 - (Util.now() - this.lastStreamUploadTime));
        this.streamUploadTimeout = setTimeout(() => this.streamData(), towait);
    }

    private streamData() {
        let stream = this.state.stream;
        if (!stream) {
            if (this.streamUploadTimeout) {
                clearTimeout(this.streamUploadTimeout);
                this.streamUploadTimeout = 0;
            }
            return;
        }

        if (!pxt.Cloud.isOnline()) {
            this.scheduleStreamData();
            return;
        }

        console.log('streaming payload...')
        let data = this.view.streamPayload(this.lastStreamUploadTime);
        this.lastStreamUploadTime = Util.now();

        if (!data) {
            this.scheduleStreamData();
            return;
        }

        pxt.streams.postPayloadAsync(stream, data)
            .catch(e => {
                core.warningNotification(lf("Oops, we could not upload your data..."));
                this.scheduleStreamData();
            }).done(() => this.scheduleStreamData());
    }

    setStream(stream: pxt.streams.JsonStream) {
        this.setState({ stream: stream });
    }

    onClick(entries: pxsim.logs.ILogEntry[]) {
        this.showStreamDialog(entries);
    }

    showStreamDialog(entries: pxsim.logs.ILogEntry[]) {
        const targetTheme = pxt.appTarget.appTheme;

        let rootUrl = pxt.appTarget.appTheme.embedUrl
        if (!/\/$/.test(rootUrl)) rootUrl += '/';
        let streamUrl = this.state.stream ? rootUrl + this.state.stream.id : undefined;

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
                    _.find('#datastreamstart').click(() => {
                        _.modal('hide');
                        core.showLoading(lf("Creating stream in Microsoft Azure..."))
                        pxt.streams.createStreamAsync()
                        .catch(e => {
                            pxt.reportException(e, {});
                            core.hideLoading();
                            core.warningNotification(lf("Oops, we could not create the stream. Please try again later."));
                        })
                        .done(stream => {
                            core.hideLoading();
                            this.setStream(stream);
                            this.showStreamDialog(entries);
                        })
                    })
                _.find('#datastreamstop').click(() => {
                    _.modal('hide');
                    this.setStream(null);
                })
            },
            htmlBody: `
<div class="ui two column grid">
  <div class="column">
    <div class="ui fluid card">
        <div class="ui image">
        </div>
        <div class="content">
            <div class="header">${lf("Local File")}</div>
            <div class="description">
                ${lf("Save the data to your local Downloads folder.")}
            </div>
        </div>
        <div id="datasavelocalfile" class="ui bottom attached button">
            <i class="download icon"></i>
            Download data
        </div>        
    </div>
  </div>
  <div class="column">
    <div id="datastreamcard" class="ui fluid card">
        <div class="ui image">
        </div>
        <div class="content">
            <div class="header">${lf("Stream to Cloud")}</div>
            <div class="description">
                ${ streamUrl ? lf("We are uploading your data to Microsoft Azure every minute.")
                : lf("Upload your data to Microsoft Azure to analyze it.")}
            </div>
        </div>
        ${streamUrl ?
                `<div id="datastream" class="ui bottom attached two buttons">
        <a target="_blank" href="${streamUrl}" class="ui green button">Open</a>
        <div id="datastreamstop" class="ui button">Stop</div>
            </div>`:
                `<div id="datastreamstart" class="ui bottom attached green button">
                <i class="play icon"></i>
                ${lf("Start")}
                </div>`
            }
    </div>
  </div>
</div>`
        }).done();
    }
}