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
    protected carouselRef: any;

    protected handlePreviousArrowClick = () => {
        this.carouselRef.scrollBy({ left: - (window.innerWidth / 2) });
    }

    protected handleNextArrowClick = () => {
        this.carouselRef.scrollBy({ left: window.innerWidth / 2 });
    }

    render() {
        const { items, selectedItem, itemTemplate, itemClassName } = this.props;

        return <div className="carousel">
            <div></div>
                <div className="carousel-arrow left" onClick={this.handlePreviousArrowClick}>
                    <i className="icon chevron left" />
                </div>
                <div className="carousel-items">
                    <div className="carousel-items-inner" ref={(el) => this.carouselRef = el}>
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