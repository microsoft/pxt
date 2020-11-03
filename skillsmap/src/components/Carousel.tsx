import * as React from "react";
import { connect } from 'react-redux';

import { SkillsMapState } from '../store/reducer';
import { Item, CarouselItem } from './CarouselItem';
import { dispatchChangeSelectedItem } from '../actions/dispatch';

import '../styles/carousel.css'

interface CarouselProps {
    title?: string;
    items: Item[];
    selectedItem?: string;
    itemTemplate?: (props: Item) => JSX.Element;
    itemClassName?: string;
    dispatchChangeSelectedItem: (id: string) => void;
}

interface CarouselState {
    showLeft: boolean;
    showRight: boolean;
}

class CarouselImpl extends React.Component<CarouselProps, CarouselState> {
    protected carouselRef: any;
    constructor(props: CarouselProps) {
        super(props);

        this.state = { showLeft: false, showRight: true };
    }

    componentDidMount() {
        window.addEventListener("resize", this.handleScroll);
    }

    componentDidUnmount() {
        window.removeEventListener("resize", this.handleScroll);
    }

    protected handleLeftArrowClick = () => {
        this.carouselRef.scrollBy({ left: - (window.innerWidth / 2) });
    }

    protected handleRightArrowClick = () => {
        this.carouselRef.scrollBy({ left: window.innerWidth / 2 });
    }

    protected handleScroll = () => {
        const scrollLeft = this.carouselRef.scrollLeft;
        this.setState({ showLeft: scrollLeft !== 0, showRight: scrollLeft !== this.carouselRef.scrollWidth - this.carouselRef.clientWidth })
    }

    render() {
        const { title, items, selectedItem, itemTemplate, itemClassName } = this.props;
        const { showLeft, showRight } = this.state;

        return <div className="carousel">
            {title && <div className="carousel-title">{title}</div>}
            {showLeft && <div className="carousel-arrow left" onClick={this.handleLeftArrowClick}>
                <i className="icon chevron left" />
            </div>}
            <div className="carousel-items">
                <div className="carousel-items-inner" onScroll={this.handleScroll} ref={(el) => this.carouselRef = el}>
                    {items.map((el, i) => {
                        return <CarouselItem key={i} className={itemClassName} item={el} itemTemplate={itemTemplate} selected={selectedItem === el.id} />
                    })}
                </div>
            </div>
            {showRight && <div className="carousel-arrow right" onClick={this.handleRightArrowClick}>
                <i className="icon chevron right" />
            </div>}
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