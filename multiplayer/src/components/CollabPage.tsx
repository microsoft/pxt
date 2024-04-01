import { useContext, useEffect, useRef, useState } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { Button } from "../../../react-common/components/controls/Button";
import { leaveCollabAsync } from "../epics/leaveCollabAsync";
import { BRUSH_COLORS, BRUSH_SIZES, BrushSize, Vec2Like } from "../types";
import { getCollabCanvas } from "../services/collabCanvas";
import * as collabClient from "../services/collabClient";
import * as CollabEpics from "../epics/collab";
import * as CollabActions from "../state/collab/actions";
import { dist, distSq, jsonReplacer } from "../util";
import { BRUSH_PROPS, PLAYER_SPRITE_DATAURLS } from "../constants";
import { nanoid } from "nanoid";
import { CollabContext } from "../state/collab";

export interface CollabPageProps {}

export default function Render(props: CollabPageProps) {
    const { state } = useContext(AppStateContext);
    const { dispatch: collabDispatch } = useContext(CollabContext);
    const { netMode, clientRole, collabInfo } = state;

    const [canvasContainer, setCanvasContainer] = useState<HTMLDivElement | null>(null);
    const [selectedColorIndex, setSelectedColorIndex] = useState(0);
    const [selectedSizeIndex, setSelectedSizeIndex] = useState(0);
    const [selectedIconIndex, setSelectedIconIndex] = useState(0);
    const [mouseDown, setMouseDown] = useState(false);
    const [lastPosition, setLastPosition] = useState<Vec2Like>({ x: 0, y: 0 });
    const [brushAlpha, setBrushAlpha] = useState(0.5);
    const [alphaSliderRef, setAlphaSliderRef] = useState<HTMLDivElement | null>(null);
    const undoStack = useRef(new Array<Set<string>>());

    useEffect(() => {
        const collabCanvas = getCollabCanvas();
        collabCanvas.reset();
        collabCanvas.addPlayerSprite(collabClient.getClientId()!, 0, 0, 0);
    }, []);

    const undo = () => {
        const undoSet = undoStack.current.pop();
        if (undoSet) {
            undoSet.forEach(spriteId => {
                getCollabCanvas().removePaintSprite(spriteId);
                collabDispatch(CollabActions.delSessionValue("s:" + spriteId));
                collabClient.delSessionValue("s:" + spriteId);
            });
        }
    };

    useEffect(() => {
        const handleKeydown = (e: KeyboardEvent) => {
            // handle ctrl-z
            if (e.key === "z" && e.ctrlKey) {
                undo();
            }
        };
        window.addEventListener("keydown", handleKeydown);
        return () => {
            window.removeEventListener("keydown", handleKeydown);
        };
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
            if (canvasMouseX < canvasContainer.scrollLeft) return;
            if (canvasMouseY < canvasContainer.scrollTop) return;
            if (canvasMouseX >= canvasContainer.scrollLeft + canvasContainer.clientWidth) return;
            if (canvasMouseY >= canvasContainer.scrollTop + canvasContainer.clientHeight) return;
            setMouseDown(true);
            setLastPosition({ x: canvasMouseX, y: canvasMouseY });
            const spriteId = nanoid();
            const undoSet = new Set<string>();
            undoSet.add(spriteId);
            undoStack.current.push(undoSet);
            getCollabCanvas().addPaintSprite(
                spriteId,
                canvasMouseX,
                canvasMouseY,
                selectedSizeIndex,
                selectedColorIndex,
                brushAlpha
            );
            collabClient.setSessionValue(
                "s:" + spriteId,
                JSON.stringify({
                    x: canvasMouseX,
                    y: canvasMouseY,
                    s: selectedSizeIndex,
                    c: selectedColorIndex,
                    a: brushAlpha,
                })
            );
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
            getCollabCanvas().updatePlayerSpritePosition(collabClient.getClientId()!, canvasMouseX, canvasMouseY);
            const newPos = { x: canvasMouseX, y: canvasMouseY };
            const newPosStr = JSON.stringify(newPos);
            // Send position to server
            collabClient.setPlayerValue("position", newPosStr);
            // Update local player position in state (may not be needed)
            collabDispatch(CollabActions.setPlayerValue(collabClient.getClientId()!, "position", newPosStr));

            if (!mouseDown) return;
            const undoSet = undoStack.current[undoStack.current.length - 1];
            const brushSize = BRUSH_PROPS[selectedSizeIndex].size;
            const brushStep = brushSize / 5;
            const posDist = dist(lastPosition, newPos);
            if (posDist > brushStep) {
                const numSteps = Math.ceil(posDist / brushStep);
                const stepX = (newPos.x - lastPosition.x) / numSteps;
                const stepY = (newPos.y - lastPosition.y) / numSteps;
                for (let i = 0; i < numSteps; i++) {
                    const spriteId = nanoid();
                    undoSet.add(spriteId);
                    const x = lastPosition.x + stepX * i;
                    const y = lastPosition.y + stepY * i;
                    getCollabCanvas().addPaintSprite(spriteId, x, y, selectedSizeIndex, selectedColorIndex, brushAlpha);
                    collabClient.setSessionValue(
                        "s:" + spriteId,
                        JSON.stringify({
                            x,
                            y,
                            s: selectedSizeIndex,
                            c: selectedColorIndex,
                            a: brushAlpha,
                        })
                    );
                }
                setLastPosition(newPos);
            }
        };
        window.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mouseup", handleMouseUp);
        window.addEventListener("mousemove", handleMouseMove);
        return () => {
            window.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("mouseup", handleMouseUp);
            window.removeEventListener("mousemove", handleMouseMove);
        };
    }, [mouseDown, canvasContainer, lastPosition, selectedColorIndex, selectedSizeIndex, brushAlpha]);

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

    useEffect(() => {
        let mouseIsDown = false;
        if (!alphaSliderRef) return;
        const handleMouseMove = (e: MouseEvent) => {
            if (!mouseIsDown) return;
            if (!alphaSliderRef) return;
            let alphaMouseY = e.clientY;
            alphaMouseY -= alphaSliderRef.offsetTop;
            alphaMouseY += alphaSliderRef.scrollTop;
            if (alphaMouseY < alphaSliderRef.scrollTop) return;
            if (alphaMouseY >= alphaSliderRef.scrollTop + alphaSliderRef.clientHeight) return;
            setBrushAlpha(alphaMouseY / alphaSliderRef.clientHeight);
        };
        const handleMouseDown = (e: MouseEvent) => {
            mouseIsDown = true;
            handleMouseMove(e);
        };
        const handleMouseUp = (e: MouseEvent) => {
            mouseIsDown = false;
        };
        alphaSliderRef.addEventListener("mousedown", handleMouseDown);
        alphaSliderRef.addEventListener("mousemove", handleMouseMove);
        alphaSliderRef.addEventListener("mouseup", handleMouseUp);
        return () => {
            alphaSliderRef?.removeEventListener("mousedown", handleMouseDown);
            alphaSliderRef?.removeEventListener("mousemove", handleMouseMove);
            alphaSliderRef?.removeEventListener("mouseup", handleMouseUp);
        };
    }, [alphaSliderRef]);

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

    const handleAlphaSliderRef = (ref: HTMLDivElement) => {
        setAlphaSliderRef(ref);
    };

    const handleUndoClick = () => {
        undo();
    };

    const SpriteRow: React.FC = ({ children }) => <div className="tw-flex tw-flex-row tw-gap-1">{children}</div>;

    const SpriteImg: React.FC<{ imgId: number }> = ({ imgId }) => (
        <div
            onClick={() => iconClicked(imgId)}
            className="tw-w-8 tw-h-8 tw-rounded-md tw-cursor-pointer tw-border-slate-800 tw-border tw-bg-slate-100"
            style={{
                backgroundImage: `url(${PLAYER_SPRITE_DATAURLS[imgId]})`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                padding: "1.1rem",
                outline: imgId === selectedIconIndex ? "3px solid " + SELECTED_COLOR : undefined,
                outlineOffset: "1px",
                imageRendering: "pixelated",
            }}
        ></div>
    );

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
                                outline: i === selectedColorIndex ? "3px solid " + SELECTED_COLOR : undefined,
                                outlineOffset: "1px",
                            }}
                            onClick={() => brushColorClicked(bc, i)}
                        ></div>
                    ))}
                    <div className="tw-h-4"></div>
                    <div className="tw-flex tw-flex-row tw-gap-1">
                        <div className="tw-flex tw-flex-col tw-gap-1 tw-items-center">
                            {BRUSH_SIZES.map((bs, i) => (
                                <div
                                    key={bs.sz}
                                    className="tw-rounded-full tw-cursor-pointer tw-border-slate-800 tw-border"
                                    style={{
                                        backgroundColor: BRUSH_COLORS[selectedColorIndex],
                                        width: bs.px + "px",
                                        height: bs.px + "px",
                                        outline: i === selectedSizeIndex ? "3px solid " + SELECTED_COLOR : undefined,
                                        outlineOffset: "1px",
                                    }}
                                    onClick={() => brushSizeClicked(bs, i)}
                                ></div>
                            ))}
                        </div>
                        <div
                            ref={handleAlphaSliderRef}
                            className="tw-relative tw-w-4 tw-h-full tw-rounded-full tw-cursor-pointer tw-border-slate-800 tw-border"
                            style={{
                                background: `linear-gradient(to bottom, transparent, ${BRUSH_COLORS[selectedColorIndex]}`,
                            }}
                        >
                            <div
                                className="tw-absolute tw-w-full tw-h-1 tw-bg-black"
                                style={{ top: brushAlpha * 100 + "%" }}
                            ></div>
                        </div>
                    </div>
                    <div className="tw-h-4"></div>
                    {[0, 2, 4].map(imgId => (
                        <SpriteRow key={imgId}>
                            <SpriteImg imgId={imgId} />
                            <SpriteImg imgId={imgId + 1} />
                        </SpriteRow>
                    ))}
                    <div className="tw-grow"></div>
                    <div>
                        <Button label="Undo" title="Undo" onClick={handleUndoClick}></Button>
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
