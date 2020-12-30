import * as React from "react";

export interface Item {
    id: string;
    label?: string;
    url?: string;
    imageUrl?: string;
}

interface CarouselItemTemplateProps extends Item {
}

function CarouselItemTemplate(props: CarouselItemTemplateProps) {
    const { label } = props;
    return <span>{ label }</span>
}

interface CarouselItemProps {
    item: Item;
    itemTemplate?: any;
    selected?: boolean;
    className?: string;
    onSelect?: (id: string) => void;
}

export function CarouselItem(props: CarouselItemProps) {
    const { item, itemTemplate, selected, className, onSelect } = props;
    const Inner = itemTemplate || CarouselItemTemplate;

    const handleClick = () => { if (onSelect) onSelect(item.id); };

    return <div className={`carousel-item ${selected ? 'selected' : ''} ${className || ''}`} onClick={handleClick} role="group">
        <Inner {...item} />
    </div>
}