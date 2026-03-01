/** @format */

import * as React from "react";
import { classList } from "../../util";

interface ChatErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ComponentType<{ error?: Error; reset?: () => void }>;
}

interface ChatErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

export class ChatErrorBoundary extends React.Component<ChatErrorBoundaryProps, ChatErrorBoundaryState> {
    constructor(props: ChatErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Chat component error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: undefined });
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                const Fallback = this.props.fallback;
                return <Fallback error={this.state.error} reset={this.handleReset} />;
            }

            return (
                <div className={classList("common-chat-error")}>
                    <div className="common-chat-error-content">
                        <div className="common-chat-error-icon">⚠️</div>
                        <div className="common-chat-error-message">
                            Chat temporarily unavailable
                        </div>
                        <button
                            className="common-button"
                            onClick={this.handleReset}
                            aria-label="Retry chat component"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ChatErrorBoundary;
