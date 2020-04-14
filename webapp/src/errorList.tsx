/// <reference path="../../built/pxtlib.d.ts" />

// TODO(dz): trim unused
import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as md from "./marked";
import * as compiler from './compiler';
import * as ReactDOM from 'react-dom';
import * as pkg from './package';
import * as toolbox from "./toolbox";
import * as core from "./core";


export interface ErrorListProps {
}
export interface ErrorListState {
}

export class ErrorList extends React.Component<ErrorListProps, ErrorListState> {
    // TODO(dz):
    render() {
        return <div className="errorList">
            Hello, World!
        </div>
    }
}