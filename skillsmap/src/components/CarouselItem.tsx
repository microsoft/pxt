import * as React from "react";
import { connect } from 'react-redux';

import { SkillsMapState } from '../store/reducer';
import { dispatchChangeSelectedItem } from '../actions/dispatch';

export interface Item {
    id: string;
    label?: string;
    url?: string;
    imageUrl?: string;
    className?: string;
}

interface CarouselItemProps {
    item: Item;
    selected?: boolean;
    dispatchChangeSelectedItem: (id: string) => void;
}

class CarouselItemImpl extends React.Component<CarouselItemProps> {
    handleClick = () => {
        this.props.dispatchChangeSelectedItem(this.props.item.id);
    }

    render() {
        const { item, selected } = this.props;

        return <div className={`carousel-item ${selected ? 'selected' : ''} ${item.className || ''}`} onClick={this.handleClick}>
            <span>{item.label}</span>
        </div>
    }
}

function mapStateToProps(state: SkillsMapState, ownProps: any) {
    return {};
}

const mapDispatchToProps = {
    dispatchChangeSelectedItem
};

export const CarouselItem = connect(mapStateToProps, mapDispatchToProps)(CarouselItemImpl);