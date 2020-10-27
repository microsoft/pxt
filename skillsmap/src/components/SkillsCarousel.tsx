import * as React from "react";
import { connect } from 'react-redux';

import { Activity, SkillsMapState } from '../store/reducer';
import { Carousel } from './Carousel';
import { Item } from './CarouselItem';

interface SkillsCarouselProps {
    selectedItem?: string;
    activities: Activity[];
}

class SkillsCarouselImpl extends React.Component<SkillsCarouselProps> {
    protected activityMap: { [key: string]: Activity};
    protected root: string;
    protected current: string;

    constructor(props: SkillsCarouselProps) {
        super(props);

        this.activityMap = {};
        props.activities.forEach(el => this.activityMap[el.id] = el);

        this.root = props.activities[0].id;
        this.current = this.root;
    }

    protected getItems(): Item[] {
        this.current = this.props.selectedItem || this.root;
        const items = [];
        let activity = this.activityMap[this.root];
        let locked = false;
        while (activity) {
            items.push({
                id: activity.id,
                label: activity.name,
                url: activity.url,
                imageUrl: activity.imageUrl,
                className: `linked ${locked ? 'locked' : ''}`
            });
            if (activity.id === this.current) locked = true;
            activity = this.activityMap[activity.next || ""];
        }

        return items;
    }

    render() {
        return <Carousel items={this.getItems()} />
    }
}

function mapStateToProps(state: SkillsMapState, ownProps: any) {
    if (!state) return {};
    return {
        selectedItem: state.selectedItem
    }
}

export const SkillsCarousel = connect(mapStateToProps)(SkillsCarouselImpl);