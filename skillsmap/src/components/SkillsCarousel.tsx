/// <reference path="../lib/skillMap.d.ts" />

import * as React from "react";
import { connect } from 'react-redux';

import { SkillsMapState } from '../store/reducer';
import { dispatchChangeSelectedItem, dispatchShowCompletionModal } from '../actions/dispatch';
import { isMapCompleted } from '../lib/skillMapUtils';
import { Carousel } from './Carousel';
import { Item } from './CarouselItem';
import { SkillCard } from './SkillCard';

interface SkillsCarouselProps {
    map: SkillsMap;
    user: UserState;
    selectedItem?: string;
    dispatchChangeSelectedItem: (id: string) => void;
    dispatchShowCompletionModal: (mapId: string, activityId?: string) => void;
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
                description: activity.description,
                tags: activity.tags,
                url: activity.url,
                imageUrl: activity.imageUrl
            });
            activity = activity.next[0]; // TODO still add nonlinear items to array even if we don't render graph
        }

        return items;
    }

    protected onItemSelect = (id: string) => {
        this.props.dispatchChangeSelectedItem(id);
    }

    protected handleEndCardClick = () => {
        this.props.dispatchShowCompletionModal(this.props.map.mapId);
    }

    protected getEndCard(): JSX.Element {
        return <div className="end-card" key="end">
            <div className="end-card-icon" onClick={this.handleEndCardClick}>
                <i className="icon trophy" />
            </div>
        </div>
    }

    render() {
        const { map, user, selectedItem } = this.props;
        const endCard = isMapCompleted(user, map) ? [this.getEndCard()] : [];

        return <Carousel title={map.displayName} items={this.items} itemTemplate={SkillCard} itemClassName="linked"
            onItemSelect={this.onItemSelect} selectedItem={selectedItem}
            appendChildren={endCard} />
    }
}

function mapStateToProps(state: SkillsMapState, ownProps: any) {
    if (!state) return {};
    return {
        user: state.user,
        selectedItem: state.selectedItem && ownProps.map?.activities?.[state.selectedItem] ? state.selectedItem : undefined
    }
}

const mapDispatchToProps = {
    dispatchChangeSelectedItem,
    dispatchShowCompletionModal
};

export const SkillsCarousel = connect(mapStateToProps, mapDispatchToProps)(SkillsCarouselImpl);