export type ToastType = "success" | "info" | "warning" | "error";

export type Toast = {
    type: ToastType;
    text?: string; // primary message
    detail?: string; // secondary message
    jsx?: React.ReactNode; // React content
    timeoutMs?: number; // if provided, will auto-dismiss after a time
    weight?: number; // heavier toasts sort downward
    textColorClass?: string; // if provided, override default text color
    backgroundColorClass?: string; // if provided, override default background color
    sliderColorClass?: string; // if provided, override default timeout slider color
    hideDismissBtn?: boolean; // if true, will hide the dismiss button
    showSpinner?: boolean; // if true, will show a spinner icon
    hideIcon?: boolean; // if true, will hide the type-specific icon
    icon?: string; // if provided, will override the type-specific icon
    className?: string; // if provided, will be appended to the toast's class list
};

export type ToastWithId = Toast & {
    id: string;
};

export type TabName = "home" | "results";

export type CardType = "checklist-resource";

// Checklist Card types that can be appear in the carousel
export type CarouselCard = {
    cardType: CardType;
};

export type CarouselChecklistResourceCard = CarouselCard & {
    cardType: "checklist-resource";
    cardTitle: string;
    imageUrl: string;
    checklistUrl: string;
};

export type CarouselCardSet = {
    cards: CarouselCard[];
};

export type RequestStatus = "init" | "loading" | "error" | "success";

export type ProjectData = pxt.Cloud.JsonScript & {
    inputText: string;
};

export type CriteriaTemplateSegment = {
    type: "plain-text" | "param";
    content: string; // plain text or parameter name
};
