/// <reference path="../lib/skillMap.d.ts" />

import * as React from "react";
import { connect } from 'react-redux';

import { SkillsMapState } from '../store/reducer';
import { Carousel } from './Carousel';
import { Item } from './CarouselItem';
import { SkillCard } from './SkillCard';

interface SkillsCarouselProps {
    map: SkillsMap;
    user: UserState;
    selectedItem?: string;
}

class SkillsCarouselImpl extends React.Component<SkillsCarouselProps> {
    protected items: Item[];

    constructor(props: SkillsCarouselProps) {
        super(props);

        this.items = this.getItems(props.map.mapId, props.map.root);
    }

    protected getItems(mapId: string, root: MapActivity): Item[] {
        const items = [];
        let activity = root;
        while (activity) {
            items.push({
                id: activity.activityId,
                mapId,
                label: activity.displayName,
                url: activity.url,
                imageUrl: activity.imageUrl
            });
            activity = activity.next[0]; // TODO still add nonlinear items to array even if we don't render graph
        }

        return items;
    }

    render() {
        return <Carousel title={this.props.map.displayName} items={this.items} itemTemplate={SkillCard} itemClassName="linked" />
    }
}

function mapStateToProps(state: SkillsMapState, ownProps: any) {
    if (!state) return {};
    return {
        progress: state.user,
        selectedItem: state.selectedItem && ownProps.map?.activities?.[state.selectedItem] ? state.selectedItem : undefined
    }
}

export const SkillsCarousel = connect(mapStateToProps)(SkillsCarouselImpl);