import * as React from "react";

/** Optional project for native asset editors hosted outside the current project. */
export const AssetEditorContext = React.createContext<pxt.TilemapProject | undefined>(undefined);