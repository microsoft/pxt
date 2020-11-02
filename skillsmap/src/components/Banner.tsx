import * as React from "react";

interface BannerProps {
    title: string;
    description: string;
    icon: string;
}

export class Banner extends React.Component<BannerProps> {
    render() {
        const  { title, description, icon } = this.props;
        return <div className="banner">
            <div className="banner-card">
                <i className={`icon ${icon}`} />
                <div className="banner-text">
                    <div className="banner-title">{title}</div>
                    <div className="banner-description">{description}</div>
                </div>
            </div>
        </div>
    }
}
