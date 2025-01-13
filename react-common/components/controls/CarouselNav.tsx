import { classList } from "../util";
import { Button } from "./Button";

export interface CarouselNavProps {
    pages: number;
    selected: number;
    maxDisplayed?: number;
    onPageSelected: (page: number) => void;
}

export const CarouselNav = (props: CarouselNavProps) => {
    const { pages, selected, maxDisplayed, onPageSelected } = props;

    const displayedPages: number[] = [];
    let start = 0;
    let end = pages;

    if (maxDisplayed) {
        start = Math.min(
            Math.max(0, selected - (maxDisplayed >> 1)),
            Math.max(0, start + pages - maxDisplayed)
        );
        end = Math.min(start + maxDisplayed, pages);
    }

    for (let i = start; i < end; i++) {
        displayedPages.push(i);
    }

    return (
        <div className="common-carousel-nav">
            <Button
                className="common-carousel-nav-arrow"
                title={lf("Previous page")}
                leftIcon="fas fa-chevron-circle-left"
                onClick={() => onPageSelected(selected - 1)}
                disabled={selected === 0}
            />
            <ul className="common-carousel-nav">
                {displayedPages.map(page =>
                    <li key={page} onClick={() => onPageSelected(page)}>
                        <Button
                            className={classList(selected === page && "selected")}
                            title={lf("Jump to page {0}", page + 1)}
                            onClick={() => onPageSelected(page)}
                            label={
                                <span className="common-carousel-nav-button-handle" />
                            }
                        />
                    </li>
                )}
            </ul>
            <Button
                className="common-carousel-nav-arrow"
                title={lf("Next page")}
                leftIcon="fas fa-chevron-circle-right"
                onClick={() => onPageSelected(selected + 1)}
                disabled={selected === pages - 1}
            />
        </div>
    )
}