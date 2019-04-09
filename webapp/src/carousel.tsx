import * as React from "react";
import * as sui from "./sui";
import * as data from "./data";

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
const DRAG_THRESHOLD = 5;

enum DraggingDirection {
    None = 0,
    X = 1,
    Y = 2
}

export class Carousel extends data.Component<ICarouselProps, ICarouselState> {
    private dragSurface: HTMLDivElement;
    private container: HTMLDivElement;
    private arrows: HTMLSpanElement[] = [];
    private isDragging = false;
    private definitelyDragging = DraggingDirection.None;

    private childWidth: number;
    private containerWidth: number;
    private arrowWidth: number;
    private actualPageLength: number;

    private currentOffset = 0;
    private index = 0;

    private dragStartX: number;
    private dragStartY: number;
    private dragStartOffset: number;
    private dragOffset: number;

    private animation: AnimationState;

    private animationId: number;
    private childrenElements: HTMLDivElement[] = [];

    constructor(props: ICarouselProps) {
        super(props);
        this.state = {
        }

        this.childrenElements = [];
        this.arrows = [];

        this.onLeftArrowClick = this.onLeftArrowClick.bind(this);
        this.onRightArrowClick = this.onRightArrowClick.bind(this);
    }

    componentWillReceiveProps(nextProps: ICarouselProps) {
        if (nextProps.selectedIndex != undefined) {
            this.setIndex(nextProps.selectedIndex);
        }
    }

    private handleContainerRef = (c: HTMLDivElement) => {
        this.container = c;
    }

    private handleDragSurfaceRef = (c: HTMLDivElement) => {
        this.dragSurface = c;
    }

    private handleArrowRefs = (c: HTMLSpanElement) => {
        this.arrows.push(c);
    }

    private handleChildRefs = (c: HTMLDivElement) => {
        if (c) this.childrenElements.push(c)
    }

    public renderCore() {
        const { rightDisabled, leftDisabled } = this.state;

        return <div className="ui carouselouter">
            <span role="button" className={"carouselarrow left aligned" + (leftDisabled ? " arrowdisabled" : "")} aria-label={lf("See previous")}
                tabIndex={leftDisabled ? -1 : 0} onClick={this.onLeftArrowClick} onKeyDown={sui.fireClickOnEnter} ref={this.handleArrowRefs}>
                <sui.Icon icon="circle angle left" />
            </span>
            <div className="carouselcontainer" ref={this.handleContainerRef}>
                <div className="carouselbody" ref={this.handleDragSurfaceRef}>
                    {
                        React.Children.map(this.props.children, (child, index) => child ?
                            <div className={`carouselitem ${this.props.selectedIndex == index ? 'selected' : ''}`} ref={this.handleChildRefs}>
                                {React.cloneElement(child as any, { tabIndex: this.isVisible(index) ? 0 : -1 })}
                            </div> : undefined)
                    }
                </div>
            </div>
            <span role="button" className={"carouselarrow right aligned" + (rightDisabled ? " arrowdisabled" : "")} aria-label={lf("See more")}
                tabIndex={rightDisabled ? -1 : 0} onClick={this.onRightArrowClick} onKeyDown={sui.fireClickOnEnter} ref={this.handleArrowRefs}>
                <sui.Icon icon="circle angle right" />
            </span>
        </div>
    }

    public onLeftArrowClick() {
        this.onArrowClick(true);
    }

    public onRightArrowClick() {
        this.onArrowClick(false);
    }

    private onArrowClick(left: boolean) {
        const prevIndex = this.index;
        const prevScroll = this.container.scrollLeft;
        this.setIndex(left ? this.index - this.actualPageLength : this.index + this.actualPageLength);
        if (left) {
            // Focus right most
            const prevElement = this.index + this.actualPageLength < prevIndex ? this.index + this.actualPageLength : prevIndex - 1;
            if (this.childrenElements[prevElement]) (this.childrenElements[prevElement].firstChild as HTMLElement).focus();
        } else {
            // Focus left most
            const nextElement = this.index > prevIndex + this.actualPageLength ? this.index : prevIndex + this.actualPageLength;
            if (this.childrenElements[nextElement]) (this.childrenElements[nextElement].firstChild as HTMLElement).focus();
        }

        // Undo any scrolling caused by focus()
        this.container.scrollLeft = prevScroll;
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
            this.definitelyDragging = DraggingDirection.None;
            this.dragStart(getX(event), getY(event));
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
                if (!this.definitelyDragging) {
                    // lock direction
                    let y = getY(event);
                    if (Math.abs(x - this.dragStartX) > DRAG_THRESHOLD) {
                        this.definitelyDragging = DraggingDirection.X;
                    } else if (Math.abs(y - this.dragStartY) > DRAG_THRESHOLD) {
                        this.definitelyDragging = DraggingDirection.Y;
                    }
                }

                if (this.definitelyDragging == DraggingDirection.X) {
                    event.stopPropagation();
                    event.preventDefault();
                    window.requestAnimationFrame(() => {
                        this.dragMove(x);
                    });
                }
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

    private dragStart(startX: number, startY: number) {
        this.isDragging = true;
        this.dragStartX = startX;
        this.dragStartY = startY;
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
        const newOffset = pxt.Util.isUserLanguageRtl() ? this.dragStartOffset + this.dragOffset : this.dragStartOffset - this.dragOffset;

        this.setPosition(newOffset);
    }

    private setPosition(offset: number) {
        if (this.dragSurface) {
            offset = Math.min(Math.max(offset, -OUT_OF_BOUND_MARGIN), this.maxScrollOffset());
            this.currentOffset = offset;

            if (pxt.Util.isUserLanguageRtl()) {
                this.dragSurface.style.marginRight = -offset + "px";
            }
            else {
                this.dragSurface.style.marginLeft = -offset + "px";
            }
        }
    }

    private calculateIndex() {
        if (this.dragSurface) {
            const bucketIndex = Math.round(Math.max(this.currentOffset, 0) / this.childWidth);
            let index: number;
            if (this.currentOffset > this.dragStartOffset) {
                index = bucketIndex;
            }
            else {
                index = bucketIndex - 1;
            }

            this.setIndex(index, 200);
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

    private isVisible(index: number) {
        return index >= this.index && index < this.index + (this.actualPageLength || 4);
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
            return this.totalLength() - this.containerWidth - OUT_OF_BOUND_MARGIN + this.arrowWidth * 2
        }
        return index * this.childWidth - this.childWidth * this.props.bleedPercent / 100;
    }

    private totalLength() {
        return React.Children.count(this.props.children) * this.childWidth + OUT_OF_BOUND_MARGIN;
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
        return Math.max(this.totalLength() - this.actualPageLength * this.childWidth + OUT_OF_BOUND_MARGIN, 0);
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

    constructor(private start: number, private end: number, private millis: number) {
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

function getY(event: MouseEvent | TouchEvent | PointerEvent) {
    if ("screenY" in event) {
        return (event as MouseEvent).screenX;
    }
    else {
        return (event as TouchEvent).changedTouches[0].screenY
    }
}