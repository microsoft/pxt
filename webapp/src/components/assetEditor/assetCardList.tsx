import * as React from "react";

import { AssetCard } from "./assetCard";


interface AssetCardListProps {
    assets: pxt.Asset[];
}

export class AssetCardList extends React.Component<AssetCardListProps> {
    container: HTMLDivElement;
    emptyCards: HTMLDivElement[];
    hasUpdatedCards = false;

    componentDidUpdate() {
        this.updateEmptyCards();
    }

    componentDidMount() {
        window.addEventListener("resize", this.updateEmptyCards);

        let interval = () => {
            if (this.hasUpdatedCards) return;
            this.updateEmptyCards();
            if (!this.hasUpdatedCards) requestAnimationFrame(interval);
        }

        requestAnimationFrame(interval);
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.updateEmptyCards);
    }

    render() {
        const { assets } = this.props;

        return <div ref={this.handleContainerRef}>
            {this.props.children}
            {assets.map(asset => <AssetCard asset={asset} key={asset.id} />)}
        </div>
    }

    handleContainerRef = (div: HTMLDivElement) => {
        if (div) {
            this.container = div;
            this.updateEmptyCards();
        }
    }

    protected updateEmptyCards = pxtc.Util.throttle(() => {
        if (!this.container) return;

        const child = this.container.firstElementChild;
        if (!child) return;

        if (!this.emptyCards) this.emptyCards = [];

        const childBounds = child.getBoundingClientRect();
        const parentBounds = this.container.getBoundingClientRect();

        // Check if we are actually visible and in DOM
        if (!childBounds.width || !childBounds.height || !parentBounds.width || !parentBounds.height) return;

        let elementWidth = childBounds.width;

        // The bounding rect width does not include all padding/margin so if there is a sibling,
        // figure out the more accurate number by subtracting their lefts
        if (child.nextElementSibling) {
            const siblingBounds = child.nextElementSibling.getBoundingClientRect();

            // Guard against a single column
            elementWidth = Math.max(elementWidth, siblingBounds.left - childBounds.left);
        }

        this.hasUpdatedCards = true;

        const columns = Math.floor(parentBounds.width / elementWidth);
        const rows = Math.floor(this.container.parentElement.getBoundingClientRect().height / elementWidth)

        let current = this.container.firstElementChild;
        let count = 0;
        let firstEmptyCard: HTMLDivElement;

        // Count the number of non-empty cards and also sort them so that the empty
        // cards are always at the end.
        while (current) {
            if (!current.classList.contains("empty-card")) {
                count++;
                if (firstEmptyCard) {
                    this.container.insertBefore(current, firstEmptyCard);
                }
            }
            else if (!firstEmptyCard) firstEmptyCard = current as HTMLDivElement;
            current = current.nextElementSibling;
        }


        let emptyCards: number;
        if (columns * rows > count) {
            // Always make sure we fill up the full space even if we don't scroll
            emptyCards = columns * rows - count;
        }
        else {
            emptyCards = columns - (count % columns);
        }

        if (emptyCards !== this.emptyCards.length) {
            if (this.emptyCards.length > emptyCards) {
                while (this.emptyCards.length > emptyCards) {
                    this.emptyCards.pop().remove();
                }
            }
            else {
                for (let i = this.emptyCards.length; i < emptyCards; i++) {
                    const div = document.createElement("div");
                    div.setAttribute("class", "asset-editor-card empty-card");
                    this.container.appendChild(div);
                    this.emptyCards.push(div);
                }
            }
        }
    }, 100);
}
