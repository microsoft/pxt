import * as React from "react";
import { connect } from 'react-redux';

import { SkillMapState } from '../store/reducer';

interface BannerProps {
    title: string;
    description: string;
    icon: string;
    infoUrl?: string;
}

export class BannerImpl extends React.Component<BannerProps> {
    render() {
        const  { title, description, icon, infoUrl } = this.props;
        return <div className="banner">
            <div className="banner-card">
                <i className={icon} aria-hidden={true} />
                <div className="banner-text">
                    <div className="banner-title">
                        <span>{title}</span>
                        {infoUrl && <a className="banner-info" href={infoUrl} target="_blank" rel="noopener noreferrer" role="button">
                            <i className="fas fa-info-circle" />
                        </a>}
                    </div>
                    <div className="banner-description">{description}</div>
                </div>
            </div>
        </div>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    return {
        title: state.title,
        description: state.description,
        infoUrl: state.infoUrl
    };
}

export const Banner = connect(mapStateToProps)(BannerImpl);