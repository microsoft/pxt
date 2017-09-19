import * as React from "react";

export interface ICarouselProps extends React.Props<Carousel> {
    // Number of items to show per "page"
    pageLength: number;
    // Percentage of child width to bleed over either edge of the page
    bleedPercent: number;
}

export interface ICarouselState {

}

const ANIMATION_MOVE_DIST = 30;
const ANIMATION_DEBUFF_DIST = 31;
const OUT_OF_BOUND_MARGIN = 20;

export class Carousel extends React.Component<ICarouselProps, ICarouselState> {
    private dragSurface: HTMLDivElement;
    private container: HTMLDivElement;
    private isDragging = false;
    private definitelyDragging = false;

    private childWidth: number;
    private childMargin: number;
    private containerWidth: number;
    private actualPageLength: number;

    private currentOffset = 0;
    private targetOffset = 0;
    private index = 0;

    private dragStartX: number;
    private dragStartOffset: number;
    private dragOffset: number;

    private animationId: number;
    private childrenElements: HTMLDivElement[] = [];

    public render() {
        this.childrenElements = [];
        return <div className="ui grid middle aligned">
            <div className="carouselarrow one wide column" onClick={() => this.onArrowClick(true)}>
                <i className="icon large circle angle left"/>
            </div>
            <div className="carouselcontainer fourteen wide column" ref={r => this.container = r}>
                <div className="carouselbody" ref={r => this.dragSurface = r}>
                {
                    React.Children.map(this.props.children, child => <div className="carouselitem" ref={r => this.childrenElements.push(r)}>
                        {child}
                    </div>)
                }
                </div>
            </div>
            <div className="carouselarrow one wide column right aligned" onClick={() => this.onArrowClick(false)}>
                <i className="icon large circle angle right"/>
            </div>
        </div>
    }

    public onArrowClick(left: boolean) {
        this.setIndex(left ? this.index - this.actualPageLength : this.index + this.actualPageLength);
    }

    public componentDidMount() {
        this.initDragSurface();
        window.addEventListener("resize", (e) => {
            this.updateDimensions();
        })
    }

    public componentDidUpdate() {
        this.updateDimensions();
    }

    public updateDimensions() {
        this.containerWidth = this.container.getBoundingClientRect().width;
        if (this.childrenElements.length) {
            this.childWidth = this.childrenElements[0].getBoundingClientRect().width;
            const margin = Math.floor((this.containerWidth - this.childWidth * this.props.pageLength - 2 * this.childWidth * this.props.bleedPercent / 100) / this.props.pageLength);
            this.childMargin = Math.max(margin, 0);
            this.childrenElements.forEach(c => c.style.marginRight = (this.childMargin + "px"));
            this.actualPageLength = Math.min(this.props.pageLength, Math.floor(this.containerWidth / (this.childMargin + this.childWidth)));
        }
        this.dragSurface.style.width = this.totalLength() + "px";
    }

    private initDragSurface() {
        this.dragSurface.addEventListener("click", event => {
            if (this.definitelyDragging) {
                event.stopPropagation();
                event.preventDefault();
                this.definitelyDragging = false;
            }
        });

        this.dragSurface.addEventListener("mousedown", event => {
            event.preventDefault();
            this.dragStart(event.screenX);
        });

        this.dragSurface.addEventListener("mouseup", event => {
            if (this.isDragging) {
                this.dragEnd();
                if (this.definitelyDragging) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        });

        this.dragSurface.addEventListener("mouseleave", event => {
            if (this.isDragging) {
                this.dragEnd();
            }
        });

        this.dragSurface.addEventListener("mousemove", event => {
            if (this.isDragging) {
                this.definitelyDragging = true;
                event.stopPropagation();
                event.preventDefault();
                this.dragMove(event.screenX);

            }
        });
    }

    private dragStart(startX: number) {
        this.isDragging = true;
        this.dragStartX = startX;
        this.dragStartOffset = this.currentOffset;
        if (this.animationId) {
            window.cancelAnimationFrame(this.animationId);
        }
    }

    private dragEnd() {
        this.isDragging = false;
        this.calculateIndex();
    }

    private dragMove(x: number) {
        this.dragOffset = x - this.dragStartX;
        const newOffset = this.dragStartOffset + this.dragOffset;

        this.setPosition(newOffset);
    }

    private setPosition(offset: number) {
        if (this.dragSurface) {
            offset = Math.max(Math.min(offset, OUT_OF_BOUND_MARGIN), this.maxScrollOffset());
            this.currentOffset = offset;
            this.dragSurface.style.marginLeft = offset + "px";
        }
    }

    private calculateIndex() {
        if (this.dragSurface) {
            const bucketIndex = Math.abs(Math.floor(this.currentOffset / (this.childWidth + this.childMargin)));
            let index: number;
            if (this.currentOffset < this.dragStartOffset) {
                index = bucketIndex;
            }
            else {
                index = bucketIndex - 1;
            }

            this.setIndex(index);
        }
    }

    private setIndex(index: number) {
        this.index = Math.max(Math.min(index, this.childrenElements.length - this.props.pageLength), 0);

        this.targetOffset = this.indexToOffset(this.index);
        this.animationId = window.requestAnimationFrame(this.easeTowardsIndex.bind(this));
    }

    private easeTowardsIndex() {
        if (this.dragSurface) {
            const diff = this.targetOffset - this.currentOffset;
            if (Math.abs(diff) < ANIMATION_DEBUFF_DIST) {
                this.setPosition(this.targetOffset);
            }
            else {
                if (diff > 0) {
                    this.setPosition(this.currentOffset + ANIMATION_MOVE_DIST);
                }
                else {
                    this.setPosition(this.currentOffset - ANIMATION_MOVE_DIST);
                }

                this.animationId = window.requestAnimationFrame(this.easeTowardsIndex.bind(this));
            }
        }
    }

    private indexToOffset(index: number) {
        if (index <= 0) {
            return 0;
        }
        return -1 * (index * (this.childWidth + this.childMargin) - this.childWidth * this.props.bleedPercent / 100);
    }

    private totalLength() {
        return React.Children.count(this.props.children) *
            (this.childWidth + this.childMargin) + OUT_OF_BOUND_MARGIN;
    }

    private maxScrollOffset() {
        return -1 * (this.totalLength() - this.props.pageLength * (this.childWidth + this.childMargin) + OUT_OF_BOUND_MARGIN);
    }
}