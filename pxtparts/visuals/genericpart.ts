
namespace pxsim.visuals {
    export function mkGenericPartSVG(partVisual: PartVisualDefinition): SVGAndSize<SVGImageElement> {
        let imgAndSize = mkImageSVG({
            image: partVisual.image,
            width: partVisual.width,
            height: partVisual.height,
            imageUnitDist: partVisual.pinDistance,
            targetUnitDist: PIN_DIST
        });
        return imgAndSize;
    }

    export class GenericPart implements IBoardPart<any> {
        public style: string = "";
        public element: SVGElement;
        defs: SVGElement[] = [];

        constructor(partVisual: PartVisualDefinition) {
            let imgAndSize = mkGenericPartSVG(partVisual);
            let img = imgAndSize.el;
            this.element = svg.elt("g");
            this.element.appendChild(img);
        }

        moveToCoord(xy: Coord): void {
            translateEl(this.element, xy);
        }

        //unused
        init(bus: EventBus, state: any, svgEl: SVGSVGElement): void { }
        updateState(): void { }
        updateTheme(): void { }
    }
}