import * as React from "react";
import { ContainerProps, classList, fireClickOnEnter } from "../../util";
import { useId } from "../../../hooks/useId";
import { AccordionProvider, removeExpanded, setExpanded, useAccordionDispatch, useAccordionState } from "./context";

export interface AccordionProps extends ContainerProps {
    multiExpand?: boolean;
    defaultExpandedIds?: string[];
    children?: React.ReactElement<AccordionItemProps>[] | React.ReactElement<AccordionItemProps>;
}

export interface AccordionItemProps extends ContainerProps {
    children?: [React.ReactElement<AccordionHeaderProps>, React.ReactElement<AccordionPanelProps>];
    noChevron?: boolean;
    itemId?: string;
    onExpandToggled?: (expanded: boolean) => void;
}

export interface AccordionHeaderProps extends ContainerProps {
}

export interface AccordionPanelProps extends ContainerProps {
}

export const Accordion = (props: AccordionProps) => {
    const {
        children,
        id,
        className,
        ariaLabel,
        ariaHidden,
        ariaDescribedBy,
        role,
        multiExpand,
        defaultExpandedIds
    } = props;

    return (
        <AccordionProvider multiExpand={multiExpand} defaultExpandedIds={defaultExpandedIds}>
            <div
                className={classList("common-accordion", className)}
                id={id}
                aria-label={ariaLabel}
                aria-hidden={ariaHidden}
                aria-describedby={ariaDescribedBy}
                role={role}
            >
                {children}
            </div>
        </AccordionProvider>
    );
};

export const AccordionItem = (props: AccordionItemProps) => {
    const {
        children,
        id,
        className,
        ariaLabel,
        ariaHidden,
        ariaDescribedBy,
        role,
        noChevron,
        itemId,
        onExpandToggled,
    } = props;

    const { expanded } = useAccordionState();
    const dispatch = useAccordionDispatch();

    const panelId = itemId ?? useId();
    const mappedChildren = React.Children.toArray(children);
    const isExpanded = expanded.indexOf(panelId) !== -1;

    const onHeaderClick = React.useCallback(() => {
        if (isExpanded) {
            dispatch(removeExpanded(panelId));
        }
        else {
            dispatch(setExpanded(panelId));
        }
        onExpandToggled?.(!isExpanded);
    }, [isExpanded]);

    return (
        <div
            className={classList("common-accordion", className)}
            id={id}
            aria-label={ariaLabel}
            aria-hidden={ariaHidden}
            aria-describedby={ariaDescribedBy}
            role={role}
        >
            <button
                className="common-accordion-header-outer"
                aria-expanded={isExpanded}
                aria-controls={panelId}
                onClick={onHeaderClick}
                onKeyDown={fireClickOnEnter}
            >
                <div>
                    {!noChevron &&
                        <div className="common-accordion-chevron">
                            <i
                                className={classList("fas", isExpanded ? "fa-chevron-down" : "fa-chevron-right")}
                                aria-hidden={true}
                            />
                        </div>
                    }
                    <div className="common-accordion-header-content">
                        {mappedChildren[0]}
                    </div>
                </div>
            </button>
            <div
                id={panelId}
                className="common-accordion-panel-outer"
                style={{ display: isExpanded ? "block" : "none" }}
            >
                {isExpanded && mappedChildren[1]}
            </div>
        </div>
    );
}

export const AccordionHeader = (props: AccordionHeaderProps) => {
    const {
        id,
        className,
        ariaLabel,
        children,
    } = props;

    return (
        <div
            id={id}
            className={classList("common-accordion-header", className)}
            aria-label={ariaLabel}
        >
            {children}
        </div>
    );
}

export const AccordionPanel = (props: AccordionPanelProps) => {
    const {
        id,
        className,
        ariaLabel,
        children,
    } = props;

    return (
        <div
            id={id}
            className={classList("common-accordion-body", className)}
            aria-label={ariaLabel}
        >
            {children}
        </div>
    );
}
