/// <reference path="../lib/skillMap.d.ts" />

import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { dispatchChangeSelectedItem, dispatchShowCompletionModal } from '../actions/dispatch';
import { isMapCompleted } from '../lib/skillMapUtils';
import { Carousel } from './Carousel';
import { Item } from './CarouselItem';
import { SkillCard } from './SkillCard';

interface SkillCarouselProps {
    map: SkillMap;
    user: UserState;
    selectedItem?: string;
    pageSourceUrl?: string;
    dispatchChangeSelectedItem: (id: string) => void;
    dispatchShowCompletionModal: (mapId: string, activityId?: string) => void;
}

class SkillCarouselImpl extends React.Component<SkillCarouselProps> {
    protected items: Item[];

    constructor(props: SkillCarouselProps) {
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

    protected renderRequirements(): JSX.Element | undefined {
        if (!this.props.pageSourceUrl) return undefined;

        const requirements = this.props.map.prerequisites;
        const completedTags = this.props.user.completedTags;

        const tags = requirements.map(req => {
            if (req.type === "tag") {
                let incomplete = req.numberCompleted;
                if (completedTags[this.props.pageSourceUrl!] && completedTags[this.props.pageSourceUrl!][req.tag]) {
                    incomplete = Math.max(incomplete - completedTags[this.props.pageSourceUrl!][req.tag], 0);
                }

                if (incomplete) {
                    return <span key={req.tag}>{incomplete} <span className="carousel-subtitle-tag">{req.tag}</span></span>
                }
            }
            return null;
        }).filter(element => !!element)


        return tags.length ? <span> Complete {tags} tutorials to unlock!</span> : undefined;
    }

    render() {
        const { map, user, selectedItem } = this.props;
        const endCard = isMapCompleted(user, map) ? [this.getEndCard()] : [];
        const requirments = this.renderRequirements();

        return <Carousel title={map.displayName} items={this.items} itemTemplate={SkillCard} itemClassName="linked"
            onItemSelect={this.onItemSelect} selectedItem={selectedItem}
            appendChildren={endCard} titleIcon={requirments && "lock"} titleDecoration={requirments}/>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};
    return {
        user: state.user,
        pageSourceUrl: state.pageSourceUrl,
        selectedItem: state.selectedItem && ownProps.map?.activities?.[state.selectedItem] ? state.selectedItem : undefined
    }
}

const mapDispatchToProps = {
    dispatchChangeSelectedItem,
    dispatchShowCompletionModal
};

export const SkillCarousel = connect(mapStateToProps, mapDispatchToProps)(SkillCarouselImpl);
