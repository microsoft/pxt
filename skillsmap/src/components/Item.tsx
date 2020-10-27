import * as React from "react";
import { connect } from 'react-redux';

import { SkillsMapState } from '../store/reducer';
import { dispatchChangeSelectedItem } from '../actions/dispatch';

interface ItemProps {
    id: string;
    selected?: boolean;
    dispatchChangeSelectedItem: (id: string) => void;
}

class ItemImpl extends React.Component<ItemProps> {
    handleClick = () => {
        this.props.dispatchChangeSelectedItem(this.props.id);
    }

    render() {
        const { id, selected } = this.props;

        return <svg className={`skills-map-item ${selected ? 'selected' : ''}`} viewBox="0 0 150 150" onClick={this.handleClick}>
                <polygon className="skills-map-hex" points="150,75 112.5,140 37.5,140 0,75 37.7,10 112.5,10" />
                <text x="50%" y="50%">{id}</text>
            </svg>
    }
}

function mapStateToProps(state: SkillsMapState, ownProps: any) {
    if (!state) return {};
    return {
        selected: state.selectedItem && ownProps.id === state.selectedItem
    }
}

const mapDispatchToProps = {
    dispatchChangeSelectedItem
};

export const Item = connect(mapStateToProps, mapDispatchToProps)(ItemImpl);