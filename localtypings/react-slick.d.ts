/// <reference path="../typings/globals/react/index.d.ts" />

declare module "react-slick" {
    interface __config {
        accessibility?: boolean
        className?: string
        adaptiveHeight?: boolean
        arrows?: boolean
        autoplay?: boolean
        autoplaySpeed?: number // integer
        centerMode?: boolean
        centerPadding?: string | any
        cssEase?: string | any
        dots?: boolean
        dotsClass?: string
        draggable?: boolean
        easing?: string
        fade?: boolean
        focusOnSelect?: boolean
        infinite?: boolean //   should the gallery wrap around it's contents
        initialSlide?: number // int
        lazyLoad?: boolean
        rtl?: boolean
        slide?: string
        slidesToShow?: number // int
        slidesToScroll?: number //  int
        speed?: number //int
        swipe?: boolean
        swipeToSlide?: boolean
        touchMove?: boolean
        touchThreshold?: number // int
        variableWidth?: boolean
        useCSS?: boolean
        vertical?: boolean
        afterChange?: (() => void)
        beforeChange?: (() => void)
        slickGoTo?: number // int
    }

    interface P extends __config {
      responsive?: { breakpoint: number; settings: __config}[]
    }

    const component: __React.ClassicComponentClass<P>;

    export default component;
}