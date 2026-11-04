// Frame abstraction used by the simulator driver policy. These types do not reference the DOM;
// the browser implementation is in simframedom.ts.
namespace pxsim {
    /** An opaque handle to one simulator frame (a board simulator or a simulator extension). */
    export interface SimFrame {
        readonly id: string;
        /** Set for simulator extensions and legacy message simulators; unset for board simulators. */
        messageChannel: string | undefined;
        /** The run last started in this frame. */
        runId: string | undefined;
        runtimeId: string | undefined;
        permanent: boolean;
        /** True until the frame has reported that it is ready. */
        loading: boolean;
        origin: string;
        /** The aspect ratio the frame reported or was created with, if any. */
        aspectRatio: number | undefined;
        /** False once the frame has left the document and can no longer receive messages. */
        readonly attached: boolean;
        /** True when `source` is the window of this frame. */
        matchesSource(source: unknown): boolean;
        focus(): void;
    }

    export interface SimFrameSpec {
        id: string;
        url: string;
        origin: string;
        runId: string;
        autofocus: boolean;
        /** Extra CSS classes for the frame's wrapper element. */
        wrapperClasses?: string[];
        /** Called when the user activates the frame's play button, before the frame takes focus. */
        onPlayClick: () => void;
    }

    export type SimFramePosition = "first" | "last" | "detached";

    export interface SimFrameAppearance {
        /** True when the run was started with `autoRun`. */
        autoRun: boolean;
        stoppedClass: string;
        invalidatedClass: string;
    }

    /** Everything the driver policy needs from the environment that holds the frames. */
    export interface SimFrameHost {
        /** The frames in display order; `skipLoaned` omits the frame lent out by `loanSimulator`. */
        frames(skipLoaned?: boolean): SimFrame[];
        frameById(id: string): SimFrame | undefined;
        createFrame(spec: SimFrameSpec, position: SimFramePosition): SimFrame;

        readonly canRemoveFrames: boolean;
        readonly canHideFrames: boolean;
        readonly canUnhideFrames: boolean;
        /** Removes the frame, through the host's exit animation when it has one. */
        removeFrame(frame: SimFrame, onComplete?: () => void): void;
        hideFrame(frame: SimFrame, onComplete?: () => void): void;
        unhideFrame(frame: SimFrame): void;
        removeAllFrames(): void;
        revealFrame(frame: SimFrame): void;

        post(frame: SimFrame, msg: SimulatorMessage): void;
        setFrameAppearance(frame: SimFrame, state: SimulatorState, appearance: SimFrameAppearance): void;
        setAspectRatio(frame: SimFrame, ratio: number): void;
        /** Blocks user interaction with the frames while the simulator is paused. */
        freeze(value: boolean): void;
        setDimmed(value: boolean): void;
    }
}
