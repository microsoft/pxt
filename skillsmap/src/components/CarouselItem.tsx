import * as React from "react";
import { connect } from 'react-redux';

import { SkillsMapState } from '../store/reducer';
import { dispatchChangeSelectedItem } from '../actions/dispatch';

export interface Item {
    id: string;
    label?: string;
    url?: string;
    imageUrl?: string;
}

interface CarouselItemTemplateProps extends Item {
}

class CarouselItemTemplate extends React.Component<CarouselItemTemplateProps> {
    render() {
        const { label } = this.props;
        return <span>{ label }</span>
    }
}

interface CarouselItemProps {
    item: Item;
    itemTemplate?: any;
    selected?: boolean;
    className?: string;
    dispatchChangeSelectedItem: (id: string) => void;
}

class CarouselItemImpl extends React.Component<CarouselItemProps> {
    handleClick = () => {
        const { item, dispatchChangeSelectedItem } = this.props;
        dispatchChangeSelectedItem(item.id);
    }

    render() {
        const { item, itemTemplate, selected, className } = this.props;
        const Inner = itemTemplate || CarouselItemTemplate;

        return <div className={`carousel-item ${selected ? 'selected' : ''} ${className || ''}`} onClick={this.handleClick}>
            <Inner {...item} />
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