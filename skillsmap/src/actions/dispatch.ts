import * as actions from './types'

export const dispatchChangeSelectedItem = (id: string) => ({ type: actions.CHANGE_SELECTED_ITEM, id });