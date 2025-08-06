export type ActionBase<Type extends string, Payload = unknown> = {
    type: Type;
    payload: Payload;
};

export type ModalOptions = {};
