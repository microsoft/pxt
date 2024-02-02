export type Notification = {
    message: string;
    duration: number; // ms
};

export type NotificationWithId = Notification & {
    id: string;
    expiration: number; // Date.now() + duration
};

export type Notifications = NotificationWithId[];

export type ModalType = "catalog-display" | "file-picker";
