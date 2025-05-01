import { ButtonFlyoutInflater } from "./buttonFlyoutInflater";
import { LabelFlyoutInflater } from "./labelFlyoutInflater";
import { MultiFlyoutRecyclableBlockInflater } from "./blockInflater";

export * from "./cachingFlyout";

export {
    ButtonFlyoutInflater,
    LabelFlyoutInflater,
    MultiFlyoutRecyclableBlockInflater
}

export function registerFlyoutInflaters() {
    ButtonFlyoutInflater.register();
    LabelFlyoutInflater.register();
    MultiFlyoutRecyclableBlockInflater.register();
}