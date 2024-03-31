import { useContext, useEffect, useState } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { Button } from "../../../react-common/components/controls/Button";
import { leaveCollabAsync } from "../epics/leaveCollabAsync";
import { BRUSH_COLORS, BRUSH_SIZES, BrushSize } from "../types";
import { getCollabCanvas } from "../services/collabCanvas";
import * as collabClient from "../services/collabClient";
import * as CollabEpics from "../epics/collab";
import { jsonReplacer } from "../util";

export interface CollabPageProps {}

export default function Render(props: CollabPageProps) {
    const { state } = useContext(AppStateContext);
    const { netMode, clientRole, collabInfo } = state;

    const [canvasContainer, setCanvasContainer] =
        useState<HTMLDivElement | null>(null);
    const [selectedColorIndex, setSelectedColorIndex] = useState(0);
    const [selectedSizeIndex, setSelectedSizeIndex] = useState(0);
    const [selectedIconIndex, setSelectedIconIndex] = useState(0);
    const [mouseDown, setMouseDown] = useState(false);

    useEffect(() => {
        const collabCanvas = getCollabCanvas();
        collabCanvas.reset();
        collabCanvas.addPlayerSprite(collabClient.getClientId()!, 0, 0, 0);
    }, []);

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (!canvasContainer) return;
            let canvasMouseX = e.clientX;
            let canvasMouseY = e.clientY;
            canvasMouseX -= canvasContainer.offsetLeft;
            canvasMouseY -= canvasContainer.offsetTop;
            canvasMouseX += canvasContainer.scrollLeft;
            canvasMouseY += canvasContainer.scrollTop;
            if (canvasMouseX < 0 || canvasMouseY < 0) return;
            if (canvasMouseX >= canvasContainer.clientWidth) return;
            if (canvasMouseY >= canvasContainer.clientHeight) return;
            setMouseDown(true);
        };
        const handleMouseUp = (e: MouseEvent) => {
            setMouseDown(false);
        };
        const handleMouseMove = (e: MouseEvent) => {
            if (!canvasContainer) return;
            // Send position of mouse on canvas
            let canvasMouseX = e.clientX;
            let canvasMouseY = e.clientY;
            canvasMouseX -= canvasContainer.offsetLeft;
            canvasMouseY -= canvasContainer.offsetTop;
            canvasMouseX += canvasContainer.scrollLeft;
            canvasMouseY += canvasContainer.scrollTop;

            // TODO: support canvas pan and zoom

            // Update local sprite position on canvas
            getCollabCanvas().updatePlayerSpritePosition(
                collabClient.getClientId()!,
                canvasMouseX,
                canvasMouseY
            );
            const pos = { x: canvasMouseX, y: canvasMouseY };
            // Send position to server
            collabClient.setPlayerValue("position", JSON.stringify(pos));
            // Update local player position in state
            CollabEpics.recvSetPlayerValue(
                collabClient.getClientId(),
                "position",
                JSON.stringify(pos, jsonReplacer)
            );

            if (!mouseDown) return;
            // TODO: send draw message
        };
        window.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mouseup", handleMouseUp);
        window.addEventListener("mousemove", handleMouseMove);
        return () => {
            window.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("mouseup", handleMouseUp);
            window.removeEventListener("mousemove", handleMouseMove);
        };
    }, [mouseDown, canvasContainer]);

    useEffect(() => {
        if (canvasContainer && !canvasContainer.firstChild) {
            const canvas = getCollabCanvas().view;
            canvasContainer.append(canvas as any);
        }
        return () => {
            if (canvasContainer) {
                const canvas = getCollabCanvas().view;
                canvasContainer.removeChild(canvas as any);
            }
        };
    }, [canvasContainer]);

    if (!collabInfo) return null;
    if (netMode !== "connected") return null;

    const leaveClick = () => {
        leaveCollabAsync("left");
    };

    const brushColorClicked = (color: string, index: number) => {
        setSelectedColorIndex(index);
    };

    const brushSizeClicked = (bs: BrushSize, index: number) => {
        setSelectedSizeIndex(index);
    };

    const iconClicked = (index: number) => {
        setSelectedIconIndex(index);
        getCollabCanvas().updatePlayerSpriteImage(collabClient.getClientId()!, index);
        collabClient.setPlayerValue("imgId", JSON.stringify(index));
    };

    const handleCanvasContainerRef = (ref: HTMLDivElement) => {
        setCanvasContainer(ref);
    };

    const SELECTED_COLOR = "#1e293b";

    return (
        <div className="tw-flex tw-flex-col tw-gap-1 tw-w-full tw-h-full tw-items-center tw-mb-4">
            <div className="tw-flex tw-grow tw-w-full tw-p-4 tw-gap-1">
                <div
                    className="tw-flex tw-flex-grow tw-w-full tw-h-full tw-bg-white tw-rounded-lg tw-shadow-lg tw-overflow-auto tw-cursor-none"
                    ref={handleCanvasContainerRef}
                ></div>
                <div className="tw-flex tw-flex-col tw-gap-1 tw-items-center tw-h-full tw-p-4 tw-bg-slate-300 tw-rounded-lg tw-shadow-lg">
                    {BRUSH_COLORS.map((bc, i) => (
                        <div
                            key={bc}
                            className="tw-w-16 tw-h-8 tw-rounded-full tw-cursor-pointer tw-border-slate-800 tw-border"
                            style={{
                                backgroundColor: bc,
                                outline:
                                    i === selectedColorIndex
                                        ? "3px solid " + SELECTED_COLOR
                                        : undefined,
                                outlineOffset: "1px",
                            }}
                            onClick={() => brushColorClicked(bc, i)}
                        ></div>
                    ))}
                    <div className="tw-h-4"></div>
                    {BRUSH_SIZES.map((bs, i) => (
                        <div
                            key={bs.sz}
                            className="tw-rounded-full tw-cursor-pointer tw-border-slate-800 tw-border"
                            style={{
                                backgroundColor:
                                    BRUSH_COLORS[selectedColorIndex],
                                width: bs.px + "px",
                                height: bs.px + "px",
                                outline:
                                    i === selectedSizeIndex
                                        ? "3px solid " + SELECTED_COLOR
                                        : undefined,
                                outlineOffset: "1px",
                            }}
                            onClick={() => brushSizeClicked(bs, i)}
                        ></div>
                    ))}
                    <div className="tw-h-4"></div>
                    <div className="tw-flex tw-flex-row tw-gap-2">
                        <div
                            onClick={() => iconClicked(0)}
                            className="tw-w-8 tw-h-8 tw-rounded-md tw-cursor-pointer tw-border-slate-800 tw-border"
                            style={{
                                backgroundImage:
                                    "url(hackathon/rt-collab/sprites/sprite-0.png)",
                                objectFit: "cover",
                                outline:
                                    0 === selectedIconIndex
                                        ? "3px solid " + SELECTED_COLOR
                                        : undefined,
                                outlineOffset: "1px",
                            }}
                        ></div>
                        <div
                            onClick={() => iconClicked(1)}
                            className="tw-w-8 tw-h-8 tw-rounded-md tw-cursor-pointer tw-border-slate-800 tw-border"
                            style={{
                                backgroundImage:
                                    "url(hackathon/rt-collab/sprites/sprite-1.png)",
                                objectFit: "cover",
                                outline:
                                    1 === selectedIconIndex
                                        ? "3px solid " + SELECTED_COLOR
                                        : undefined,
                                outlineOffset: "1px",
                            }}
                        ></div>
                    </div>
                    <div className="tw-flex tw-flex-row tw-gap-2">
                        <div
                            onClick={() => iconClicked(2)}
                            className="tw-w-8 tw-h-8 tw-rounded-md tw-cursor-pointer tw-border-slate-800 tw-border"
                            style={{
                                backgroundImage:
                                    "url(hackathon/rt-collab/sprites/sprite-2.png)",
                                objectFit: "cover",
                                outline:
                                    2 === selectedIconIndex
                                        ? "3px solid " + SELECTED_COLOR
                                        : undefined,
                                outlineOffset: "1px",
                            }}
                        ></div>
                        <div
                            onClick={() => iconClicked(3)}
                            className="tw-w-8 tw-h-8 tw-rounded-md tw-cursor-pointer tw-border-slate-800 tw-border"
                            style={{
                                backgroundImage:
                                    "url(hackathon/rt-collab/sprites/sprite-3.png)",
                                objectFit: "cover",
                                outline:
                                    3 === selectedIconIndex
                                        ? "3px solid " + SELECTED_COLOR
                                        : undefined,
                                outlineOffset: "1px",
                            }}
                        ></div>
                    </div>
                    <div className="tw-flex tw-flex-row tw-gap-2">
                        <div
                            onClick={() => iconClicked(4)}
                            className="tw-w-8 tw-h-8 tw-rounded-md tw-cursor-pointer tw-border-slate-800 tw-border"
                            style={{
                                backgroundImage:
                                    "url(hackathon/rt-collab/sprites/sprite-4.png)",
                                objectFit: "cover",
                                outline:
                                    4 === selectedIconIndex
                                        ? "3px solid " + SELECTED_COLOR
                                        : undefined,
                                outlineOffset: "1px",
                            }}
                        ></div>
                        <div
                            onClick={() => iconClicked(5)}
                            className="tw-w-8 tw-h-8 tw-rounded-md tw-cursor-pointer tw-border-slate-800 tw-border"
                            style={{
                                backgroundImage:
                                    "url(hackathon/rt-collab/sprites/sprite-5.png)",
                                objectFit: "cover",
                                outline:
                                    5 === selectedIconIndex
                                        ? "3px solid " + SELECTED_COLOR
                                        : undefined,
                                outlineOffset: "1px",
                            }}
                        ></div>
                    </div>
                </div>
            </div>
            <div
                className="tw-flex tw-flex-row tw-gap-1"
                style={{
                    minHeight: "3rem",
                }}
            >
                <div className="tw-border tw-border-slate-800 tw-bg-slate-100 tw-px-4 tw-py-2 tw-w-fit tw-h-fit tw-rounded-lg tw-text-lg tw-font-semibold tw-font-mono">
                    {collabInfo.joinCode}
                </div>
                <div>
                    <Button
                        title={"Leave"}
                        label={"Leave"}
                        onClick={leaveClick}
                        className="tw-bg-indigo-700 tw-text-slate-100 tw-rounded-lg"
                    />
                </div>
            </div>
        </div>
    );
}
