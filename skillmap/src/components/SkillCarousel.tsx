/// <reference path="../lib/skillMap.d.ts" />

import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';
import { dispatchChangeSelectedItem, dispatchShowCompletionModal, dispatchSetSkillMapCompleted } from '../actions/dispatch';
import { isMapCompleted, isMapUnlocked } from '../lib/skillMapUtils';
import { tickEvent } from '../lib/browserUtils';
import { Carousel } from './Carousel';
import { Item } from './CarouselItem';
import { SkillCard } from './SkillCard';

interface SkillCarouselItem extends Item {
    mapId: string;
    description?: string;
    tags?: string[];
}

interface SkillCarouselProps {
    map: SkillMap;
    requiredMaps: SkillMap[];
    user: UserState;
    selectedItem?: string;
    pageSourceUrl: string;
    completionState: "incomplete" | "transitioning" | "completed";
    dispatchChangeSelectedItem: (mapId?: string, activityId?: string) => void;
    dispatchShowCompletionModal: (mapId: string, activityId?: string) => void;
    dispatchSetSkillMapCompleted: (mapId: string) => void;
}

class SkillCarouselImpl extends React.Component<SkillCarouselProps> {
    protected carouselRef: any;
    protected items: SkillCarouselItem[];

    constructor(props: SkillCarouselProps) {
        super(props);

        this.items = this.getItems(props.map.mapId, props.map.root);
    }

    protected getItems(mapId: string, root: MapNode): SkillCarouselItem[] {
        const items = [];
        let activities: MapNode[] = [root];
        while (activities.length > 0) {
            let current = activities.shift();
            if (current) {
                if (current.kind === "activity") {
                    items.push({
                        id: current.activityId,
                        label: current.displayName,
                        url: current.url,
                        imageUrl: current.imageUrl,
                        mapId,
                        description: current.description,
                        tags: current.tags
                    });
                }
                activities = activities.concat(current.next);
            }
        }

        return items;
    }

    protected onItemSelect = (id: string) => {
        const { map, dispatchChangeSelectedItem } = this.props;
        if (id !== this.props.selectedItem) {
            tickEvent("skillmap.carousel.item.select", { path: map.mapId, activity: id });
            dispatchChangeSelectedItem(map.mapId, id);
        } else {
            tickEvent("skillmap.carousel.item.deselect", { path: map.mapId, activity: id });
            dispatchChangeSelectedItem(undefined);
        }
    }

    protected handleEndCardClick = () => {
        const { map, dispatchShowCompletionModal } = this.props;
        tickEvent("skillmap.carousel.endcard.click", { path: map.mapId });
        dispatchShowCompletionModal(map.mapId);
    }

    protected handleEndCardTransition = () => {
        const { map, dispatchShowCompletionModal } = this.props;
        tickEvent("skillmap.carousel.endcard.auto", { path: map.mapId });
        dispatchShowCompletionModal(map.mapId);
    }

    protected handleCarouselRef = (el: Carousel | null) => {
        this.carouselRef = el;
    }

    protected getEndCard(completed: boolean): JSX.Element {
        const { completionState } = this.props;

        return <div className={`end-card ${completionState === "completed" ? "spin" : ""}`} key="end">
            <div className="end-card-icon" onClick={completed ? this.handleEndCardClick : undefined} role="button">
                {completionState === "transitioning" || completionState === "completed"
                    ? <i className="fas fa-trophy" onTransitionEnd={this.handleEndCardTransition} />
                    : <div className="end-card-placeholder" />
                }
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
                    return <span key={"tag_" + req.tag}>{incomplete} <span className="carousel-subtitle-tag">{req.tag}</span></span>
                }
            }
            return null;
        }).filter(element => !!element) as JSX.Element[];

        const finishedMaps = this.props.requiredMaps.map(map =>
            <span key={"map_" + map.mapId} className="carousel-subtitle-map">{map.displayName}</span>
        );

        if (!tags.length && !finishedMaps.length) {
            return undefined;
        }
        else if (!finishedMaps.length) {
            return formatString(lf("Complete {0} tutorial(s) to unlock!", "{0}"), [formatList(tags)]);
        }
        else if (!tags.length) {
            return formatString(lf("Complete the {0} map(s) to unlock!", "{0}"), [formatList(finishedMaps)]);
        }
        else {
            return formatString(lf("Complete {0} tutorial(s) and the {1} map(s) to unlock!", "{0}", "{1}"), [formatList(tags), formatList(finishedMaps)]);
        }
    }

    componentDidUpdate(props: SkillCarouselProps) {
        if (props.completionState === "transitioning") {
            // Scroll to end so user can see end card, then dispatch animation
            this.carouselRef.scrollTo(10000);
            setTimeout(() => props.dispatchSetSkillMapCompleted(props.map.mapId), 400);
        }
    }

    render() {
        const { map, user, selectedItem, pageSourceUrl } = this.props;
        const completed = isMapCompleted(user, pageSourceUrl, map);
        const endCard = [this.getEndCard(completed)];
        const requirments = this.renderRequirements();

        return <Carousel title={map.displayName} items={this.items} itemTemplate={SkillCard} itemClassName="linked"
            onItemSelect={this.onItemSelect} selectedItem={selectedItem}
            appendChildren={endCard} titleIcon={requirments && "fas fa-lock"} titleDecoration={requirments}
            ref={this.handleCarouselRef} />
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};

    const map: SkillMap = ownProps.map;
    const mapProgress = state.user?.mapProgress?.[state.pageSourceUrl];
    let requiredMaps: SkillMap[] = [];

    if (map.prerequisites?.length && state.pageSourceUrl) {
        requiredMaps = map.prerequisites
            .filter(req => req.type === "map" && !isMapUnlocked(state.user, state.maps[req.mapId], state.pageSourceUrl!))
            .map(req => state.maps[(req as MapFinishedPrerequisite).mapId]);

    }

    return {
        user: state.user,
        requiredMaps,
        pageSourceUrl: state.pageSourceUrl,
        completionState: mapProgress?.[map.mapId]?.completionState,
        selectedItem: state.selectedItem && ownProps.map?.activities?.[state.selectedItem.activityId] ? state.selectedItem.activityId : undefined
    }
}



function formatList(elements: JSX.Element[]) {
    // FIXME: "and" does not localize well
    if (elements.length <= 1) return elements[0];
    else if (elements.length === 2) return <span>{elements[0]} and {elements[1]}</span>;
    else {
        return <span>
            {elements.slice(0, elements.length - 1).map(e => <span>{e}, </span>)} and {elements[elements.length - 1]}
        </span>
    }
}

function formatString(fmtString: string, elements: JSX.Element[]) {
    let out: JSX.Element[] = [];
    let current = fmtString;
    let index = 0;
    for (let i = 0; i < elements.length; i++) {
        const parts = current.split("{" + i + "}");
        out.push(<span key={index++}>{parts[0]}</span>);
        out.push(<span key={index++}>{elements[i]}</span>);
        current = current.substr(parts[0].length + 3);
    }
    out.push(<span key={index++}>{current}</span>);

return <span>{out}</span>
}


const mapDispatchToProps = {
    dispatchChangeSelectedItem,
    dispatchShowCompletionModal,
    dispatchSetSkillMapCompleted
};

export const SkillCarousel = connect(mapStateToProps, mapDispatchToProps)(SkillCarouselImpl);
