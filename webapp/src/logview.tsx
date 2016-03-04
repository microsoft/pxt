import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"

export interface ILogProps {
    maxEntries?: number;
}
export interface ILogEntry {
    id: number;
    value: string;
    source: string;
    count: number;
}
export interface ILogState {
    entries: ILogEntry[];
}

export class LogView extends React.Component<ILogProps, ILogState> {
    static counter = 0;
    private shouldScroll = false;

    constructor(props: ILogProps) {
        super(props)
        this.state = {
            entries: []
        }

        window.addEventListener('message', (ev: MessageEvent) => {
            let msg = ev.data;
            switch(msg.type || '') {
                case 'run': this.setState({ entries: []}); break;
                case 'serial':
                    let value = msg.data || '';
                    let source = msg.id || (ev.source.frameElement ? ev.source.frameElement.id : '') || '?';
                    this.setState(prev => {
                        let last = prev.entries[prev.entries.length - 1];
                        let ens = prev.entries.slice(0, this.props.maxEntries);
                        if (last && last.value == value && last.source && source) {
                            ens[ens.length - 1].count++;
                        } else {
                            ens.push({
                                id: LogView.counter++,
                                value: value,
                                source: source,
                                count: 1
                            });
                        }
                        return { entries: ens };
                    })
                break;
            }
        }, false)
    }

    static defaultProps: ILogProps = {
        maxEntries: 200
    }

    componentWillUpdate() {
        let node = ReactDOM.findDOMNode(this) as HTMLElement;
        this.shouldScroll = node.scrollTop + node.offsetHeight === node.scrollHeight;
    }

    componentDidUpdate() {
        if (this.shouldScroll) {
            let node = ReactDOM.findDOMNode(this);
            node.scrollTop = node.scrollHeight
        }
    }

    render() {
        let msgs = this.state.entries.map(entry =>
            <div className="ui log" key={entry.id}>
                {entry.count > 1 ? <span className="ui log counter">{entry.count}</span> : ""}
                {entry.value}
            </div>);

        return <div className='ui segment hideempty logs'>
            {msgs}
        </div>;
    }
}