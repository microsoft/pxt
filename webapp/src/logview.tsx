/// <reference path="../../built/pxtsim.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"
import * as core from "./core";

const STREAM_INTERVAL = 30000;

export interface LogViewState {
    stream?: pxt.streams.JsonStream;
    trends?: boolean;
}

export class LogView extends React.Component<{}, LogViewState> {
    private view: pxsim.logs.LogViewElement;

    constructor(props: any) {
        super(props);
        this.view = new pxsim.logs.LogViewElement({
            maxEntries: 80,
            maxAccValues: 500,
            onClick: (es) => this.onClick(es),
            onTrendChartChanged: () => this.setState({ trends: this.view.hasTrends() })
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
        const streams = pxt.appTarget.simulator && !!pxt.appTarget.simulator.streams;

        if (streams && this.state.stream) this.view.setLabel(lf("streaming to cloud"), "green cloudflash");
        else if (streams && this.state.trends) this.view.setLabel(lf("streaming off"), "gray");
        else this.view.setLabel(undefined);
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
        let towait = Math.max(100, STREAM_INTERVAL - (Util.now() - this.lastStreamUploadTime));
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

        pxt.debug('streaming payload...')
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
        const streaming = pxt.appTarget.simulator && !!pxt.appTarget.simulator.streams;
        let rootUrl = targetTheme.embedUrl

        if (!rootUrl) {
            pxt.commands.browserDownloadAsync(pxsim.logs.entriesToCSV(entries), "data.csv", 'text/csv')
            return;
        }

        if (!/\/$/.test(rootUrl)) rootUrl += '/';
        let streamUrl = this.state.stream ? rootUrl + this.state.stream.id : undefined;

        core.confirmAsync({
            logos: streaming ? ["https://az851932.vo.msecnd.net/pub/hjlxsmaf"] : undefined, // azure logo
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
                        core.showLoading(lf("creating stream in Microsoft Azure..."))
                        pxt.streams.createStreamAsync(pxt.appTarget.id)
                            .then(stream => {
                                core.hideLoading();
                                this.setStream(stream);
                            }).catch(e => {
                                pxt.reportException(e, {});
                                core.hideLoading();
                                core.warningNotification(lf("Oops, we could not create the stream. Please try again later."));
                            }).done();
                    })
                _.find('#datastreamstop').click(() => {
                    _.modal('hide');
                    this.setStream(null);
                })
            },
            htmlBody: `
<div class="ui cards">
    <div class="ui card">
        <div class="content">
            <div class="header">${lf("Local File")}</div>
            <div class="description">
                ${lf("Save the data to your 'Downloads' folder.")}
            </div>
        </div>
        <div id="datasavelocalfile" class="ui bottom attached button">
            <i class="download icon"></i>
            ${lf("Download data")}
        </div>        
    </div>
    ${streaming ?
                `<div id="datastreamcard" class="ui card">
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
            </div>` :
                    `<div id="datastreamstart" class="ui bottom attached green button">
                <i class="play icon"></i>
                ${lf("Start")}
                </div>`
                }
  </div>` : ``}
</div>`
        }).done();
    }
}