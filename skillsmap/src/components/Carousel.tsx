import * as React from "react";
import { connect } from 'react-redux';

import { SkillsMapState } from '../store/reducer';
import { Item, CarouselItem } from './CarouselItem';
import { dispatchChangeSelectedItem } from '../actions/dispatch';

import '../styles/carousel.css'

interface CarouselProps {
    items: Item[];
    selectedItem?: string;
    itemTemplate?: (props: Item) => JSX.Element;
    itemClassName?: string;
    dispatchChangeSelectedItem: (id: string) => void;
}

class CarouselImpl extends React.Component<CarouselProps> {
    protected handlePreviousArrowClick = () => {
        const { items, selectedItem } = this.props;
        const index = items.findIndex(el => el.id === selectedItem);
        this.props.dispatchChangeSelectedItem(items[Math.max(index - 1, 0)].id);
    }

    protected handleNextArrowClick = () => {
        const { items, selectedItem } = this.props;
        const index = items.findIndex(el => el.id === selectedItem);
        this.props.dispatchChangeSelectedItem(items[Math.min(index + 1, items.length - 1)].id);
    }

    render() {
        const { items, selectedItem, itemTemplate, itemClassName } = this.props;

        return <div className="carousel">
            <div></div>
                <div className="carousel-arrow left" onClick={this.handlePreviousArrowClick}>
                    <i className="icon chevron left" />
                </div>
                <div className="carousel-items">
                    <div className="carousel-items-inner">
                        {items.map((el, i) => {
                            return <CarouselItem key={i} className={itemClassName} item={el} itemTemplate={itemTemplate} selected={selectedItem === el.id} />
                        })}
                    </div>
                </div>
                <div className="carousel-arrow right" onClick={this.handleNextArrowClick}>
                    <i className="icon chevron right" />
                </div>
        </div>
    }
}

function mapStateToProps(state: SkillsMapState, ownProps: any) {
    if (!state) return {};
    return {
        selectedItem: state.selectedItem
    }
}

const mapDispatchToProps = {
    dispatchChangeSelectedItem
};

export const Carousel = connect(mapStateToProps, mapDispatchToProps)(CarouselImpl);