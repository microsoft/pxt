import * as React from "react";
import * as sui from "./sui";

export interface ICarouselProps extends React.Props<Carousel> {
    // Percentage of child width to bleed over either edge of the page
    bleedPercent: number;
    selectedIndex?: number;
}

export interface ICarouselState {
    leftDisabled?: boolean;
    rightDisabled?: boolean;
}

const OUT_OF_BOUND_MARGIN = 300;

export class Carousel extends React.Component<ICarouselProps, ICarouselState> {
    private dragSurface: HTMLDivElement;
    private container: HTMLDivElement;
    private arrows: HTMLSpanElement[] = [];
    private isDragging = false;
    private definitelyDragging = false;
    private cancelClick = false;

    private childWidth: number;
    private containerWidth: number;
    private arrowWidth: number;
    private actualPageLength: number;

    private currentOffset = 0;
    private index = 0;

    private dragStartX: number;
    private dragStartOffset: number;
    private dragOffset: number;

    private animation: AnimationState;

    private animationId: number;
    private childrenElements: HTMLDivElement[] = [];

    componentWillReceiveProps(nextProps: ICarouselProps) {
        if (nextProps.selectedIndex != undefined) {
            this.setIndex(nextProps.selectedIndex);
        }
    }

    public render() {
        this.childrenElements = [];
        this.arrows = [];
        const { rightDisabled, leftDisabled } = this.state || {} as any;
        return <div className="ui carouselouter">
            <span className={"carouselarrow left aligned" + (leftDisabled ? " arrowdisabled" : "")} tabIndex={leftDisabled ? -1 : 0} onClick={() => this.onArrowClick(true)} ref={r => this.arrows.push(r)}>
                <sui.Icon icon="circle angle left"/>
            </span>
            <div className="carouselcontainer" ref={r => this.container = r}>
                <div className="carouselbody" ref={r => this.dragSurface = r}>
                {
                    React.Children.map(this.props.children, (child, index) => <div className={`carouselitem ${this.props.selectedIndex == index ? 'selected' : ''}`} ref={r => r && this.childrenElements.push(r)}>
                        {child}
                    </div>)
                }
                </div>
            </div>
            <span className={"carouselarrow right aligned" + (rightDisabled ? " arrowdisabled" : "")} tabIndex={rightDisabled ? -1 : 0} onClick={() => this.onArrowClick(false)} ref={r => this.arrows.push(r)}>
                <sui.Icon icon="circle angle right"/>
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
            let shouldReposition = false;
            this.containerWidth = this.container.getBoundingClientRect().width;
            this.getArrowWidth();
            if (this.childrenElements.length) {
                const newWidth = this.childrenElements[0].getBoundingClientRect().width;
                if (newWidth !== this.childWidth) {
                    this.childWidth = newWidth;
                    shouldReposition = true;
                }
                this.actualPageLength = Math.floor(this.containerWidth / this.childWidth)
            }
            this.dragSurface.style.width = this.totalLength() + "px";
            this.updateArrows();

            if (this.index >= this.maxIndex()) {
                shouldReposition = true;
                this.index = this.maxIndex();
            }

            if (shouldReposition) {
                this.setPosition(this.indexToOffset(this.index));
            }
        }
    }

    private initDragSurface() {
        let down = (event: MouseEvent | TouchEvent | PointerEvent) => {
            this.definitelyDragging = false;
            this.dragStart(getX(event));
        };

        let up = (event: MouseEvent | TouchEvent | PointerEvent) => {
            if (this.isDragging) {
                this.dragEnd();
                if (this.definitelyDragging) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        };

        let leave = (event: MouseEvent | TouchEvent | PointerEvent) => {
            if (this.isDragging) {
                this.dragEnd();
            }
        };

        let move = (event: MouseEvent | TouchEvent | PointerEvent) => {
            if (this.isDragging) {
                let x = getX(event);
                if (Math.abs(x - this.dragStartX) > 3) {
                    this.definitelyDragging = true;
                }
                event.stopPropagation();
                event.preventDefault();
                window.requestAnimationFrame(() => {
                    this.dragMove(x);
                });
            }
        };


        this.dragSurface.addEventListener("click", event => {
            if (this.definitelyDragging) {
                event.stopPropagation();
                event.preventDefault();
            }
        });


        if ((window as any).PointerEvent) {
            this.dragSurface.addEventListener("pointerdown", down);
            this.dragSurface.addEventListener("pointerup", up);
            this.dragSurface.addEventListener("pointerleave", leave);
            this.dragSurface.addEventListener("pointermove", move);
        }
        else {
            this.dragSurface.addEventListener("mousedown", down);
            this.dragSurface.addEventListener("mouseup", up);
            this.dragSurface.addEventListener("mouseleave", leave);
            this.dragSurface.addEventListener("mousemove", move);

            if (pxt.BrowserUtils.isTouchEnabled()) {
                this.dragSurface.addEventListener("touchstart", down);
                this.dragSurface.addEventListener("touchend", up);
                this.dragSurface.addEventListener("touchcancel", leave);
                this.dragSurface.addEventListener("touchmove", move);
            }
        }
    }

    private dragStart(startX: number) {
        this.isDragging = true;
        this.dragStartX = startX;
        this.dragStartOffset = this.currentOffset;
        if (this.animationId) {
            window.cancelAnimationFrame(this.animationId);
            this.animationId = 0;
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
        if (index === this.maxIndex()) {
            return -1 * (this.totalLength() - this.containerWidth - OUT_OF_BOUND_MARGIN + this.arrowWidth * 2)
        }
        return -1 * (index * this.childWidth - this.childWidth * this.props.bleedPercent / 100);
    }

    private totalLength() {
        return React.Children.count(this.props.children) * this.childWidth  + OUT_OF_BOUND_MARGIN;
    }

    private getArrowWidth() {
        if (this.arrows.length) {
            this.arrowWidth = 0;
            this.arrows.forEach(a => {
                if (a) {
                    this.arrowWidth = Math.max(a.getBoundingClientRect().width, this.arrowWidth)
                }
            });
        }
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

function getX(event: MouseEvent | TouchEvent | PointerEvent) {
    if ("screenX" in event) {
        return (event as MouseEvent).screenX;
    }
    else {
        return (event as TouchEvent).changedTouches[0].screenX
    }
}