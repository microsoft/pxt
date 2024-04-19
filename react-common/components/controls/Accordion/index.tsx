import { Accordion as AccordionControl, AccordionHeader, AccordionItem, AccordionPanel } from "./Accordion";

export const Accordion = Object.assign(
    AccordionControl,
    {
        Header: AccordionHeader,
        Item: AccordionItem,
        Panel: AccordionPanel
    }
);