import * as React from "react";

export interface ICarouselProps extends React.Props<Carousel> {
    // Percentage of child width to bleed over either edge of the page
    bleedPercent: number;
}

export interface ICarouselState {
    leftDisabled?: boolean;
    rightDisabled?: boolean;
}

const OUT_OF_BOUND_MARGIN = 80;

export class Carousel extends React.Component<ICarouselProps, ICarouselState> {
    private dragSurface: HTMLDivElement;
    private container: HTMLDivElement;
    private isDragging = false;
    private definitelyDragging = false;

    private childWidth: number;
    private containerWidth: number;
    private actualPageLength: number;

    private currentOffset = 0;
    private index = 0;

    private dragStartX: number;
    private dragStartOffset: number;
    private dragOffset: number;

    private animation: AnimationState;

    private animationId: number;
    private childrenElements: HTMLDivElement[] = [];

    public render() {
        this.childrenElements = [];
        const { rightDisabled, leftDisabled } = this.state || {} as any;
        return <div className="ui carouselouter">
            <span className={"carouselarrow left aligned" + (leftDisabled ? " arrowdisabled" : "")} tabIndex={0} onClick={() => this.onArrowClick(true)}>
                <i className="icon circle angle left"/>
            </span>
            <div className="carouselcontainer" ref={r => this.container = r}>
                <div className="carouselbody" ref={r => this.dragSurface = r}>
                {
                    React.Children.map(this.props.children, child => <div className="carouselitem" ref={r => r && this.childrenElements.push(r)}>
                        {child}
                    </div>)
                }
                </div>
            </div>
            <span className={"carouselarrow right aligned" + (rightDisabled ? " arrowdisabled" : "")} tabIndex={0} onClick={() => this.onArrowClick(false)}>
                <i className="icon circle angle right"/>
            </span>
        </div>
    }

    public onArrowClick(left: boolean) {
        this.setIndex(left ? this.index - this.actualPageLength : this.index + this.actualPageLength);
    }

    public componentDidMount() {
        this.initDragSurface();
        this.updateDimensions();
        window.addEventListener("resize", (e) => {
            this.updateDimensions();
        })
    }

    public componentDidUpdate() {
        this.updateDimensions();
    }

    public updateDimensions() {
        if (this.container) {
            this.containerWidth = this.container.getBoundingClientRect().width;
            if (this.childrenElements.length) {
                this.childWidth = this.childrenElements[0].getBoundingClientRect().width;
                this.actualPageLength = Math.floor(this.containerWidth / this.childWidth)
            }
            this.dragSurface.style.width = this.totalLength() + "px";
            this.updateArrows();
        }
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
                if (Math.abs(event.screenX - this.dragStartX) > 3) {
                    this.definitelyDragging = true;
                }
                event.stopPropagation();
                event.preventDefault();
                window.requestAnimationFrame(() => {
                    this.dragMove(event.screenX);
                });
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
            const bucketIndex = Math.abs(Math.floor(this.currentOffset / this.childWidth));
            let index: number;
            if (this.currentOffset < this.dragStartOffset) {
                index = bucketIndex;
            }
            else {
                index = bucketIndex - 1;
            }

            this.setIndex(index, 100);
        }
    }

    private setIndex(index: number, millis?: number) {
        const newIndex = Math.max(Math.min(index, this.maxIndex()), 0);

        if (!millis) {
            millis = Math.abs(newIndex - this.index) * 100;
        }

        this.index = newIndex;
        this.updateArrows();

        this.animation = new AnimationState(this.currentOffset, this.indexToOffset(this.index), millis);
        if (!this.animationId) {
            this.animationId = window.requestAnimationFrame(this.easeTowardsIndex.bind(this));
        }
    }

    private easeTowardsIndex(time: number) {
        if (this.dragSurface) {
            this.setPosition(this.animation.getPosition(time));
            if (this.animation.isComplete) {
                this.animation = undefined;
                this.animationId = 0;
            }
            else {
                this.animationId = window.requestAnimationFrame(this.easeTowardsIndex.bind(this));
            }
        }
    }

    private indexToOffset(index: number) {
        if (index <= 0) {
            return 0;
        }
        return -1 * (index * this.childWidth - this.childWidth * this.props.bleedPercent / 100);
    }

    private totalLength() {
        return React.Children.count(this.props.children) * this.childWidth  + OUT_OF_BOUND_MARGIN;
    }

    private maxScrollOffset() {
        return Math.min(-1 * (this.totalLength() - this.actualPageLength * this.childWidth + OUT_OF_BOUND_MARGIN), 0);
    }

    private maxIndex() {
        return Math.max(this.childrenElements.length - this.actualPageLength, 0);
    }

    private updateArrows() {
        const { rightDisabled, leftDisabled } = this.state || {} as any;
        const newRightDisabled = this.index === this.maxIndex();
        const newLeftDisabled = this.index === 0;

        if (newRightDisabled !== rightDisabled || newLeftDisabled !== leftDisabled) {
            this.setState({
                leftDisabled: newLeftDisabled,
                rightDisabled: newRightDisabled
            });
        }
    }
}

class AnimationState {
    private slope: number;
    private startTime: number;
    public isComplete = false;

    constructor (private start: number, private end: number, private millis: number) {
        this.slope = (end - start) / millis;
    }

    getPosition(time: number) {
        if (this.isComplete) return this.end;
        if (this.startTime === undefined) {
            this.startTime = time;
            return this.start;
        }
        const diff = time - this.startTime;
        if (diff > this.millis) {
            this.isComplete = true;
            return this.end;
        }
        return this.start + Math.floor(this.slope * diff);
    }
}