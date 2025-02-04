/// <reference path="../../../../localtypings/ocv.d.ts" />
import { useEffect } from "react"
import { initFeedbackEventListener, removeFeedbackEventListener } from "./FeedbackEventListener";
import { baseConfig, ratingFeedbackConfig, appId, feedbackFrameUrl } from "./configs";
import { Modal } from "../Modal";

// both components require onClose because the feedback modal should close when the user clicks the "finish" button
// this would not happen if the EventListener did not have a callback to close the modal
interface IFeedbackModalProps {
  feedbackConfig: ocv.IFeedbackConfig;
  frameId: string;
  title: string;
  onClose: () => void;
}

// right now, there are two kinds of feedback that I think could be valuable for our targets
// generic and rating feedback, but we will likely want to expand this
interface IFeedbackProps {
  kind: ocv.FeedbackKind;
  onClose: () => void;
}

// Wrapper component of the feedback modal so kind can determine what feedback actually shows in the modal
export const Feedback = (props: IFeedbackProps) => {
  const { kind, onClose } = props;
  return (
    <>
      {kind === "generic" &&
        <FeedbackModal
        feedbackConfig={baseConfig}
        frameId="menu-feedback-frame"
        title={lf("Leave Feedback")}
        onClose={onClose}
      />}
      {kind === "rating" &&
        <FeedbackModal
        feedbackConfig={ratingFeedbackConfig}
        frameId="activity-feedback-frame"
        title={lf("Rate this activity")}
        onClose={onClose} />
      }
    </>
  )
}

export const FeedbackModal = (props: IFeedbackModalProps) => {
  const { feedbackConfig, frameId, title, onClose } = props;

  const onDismiss = () => {
    onClose();
  }

  let callbacks = { onDismiss };

  useEffect(() => {
    initFeedbackEventListener(feedbackConfig, frameId, callbacks);
    return () => {
        removeFeedbackEventListener();
    }
  }, [])
  return (
    <Modal className="feedback-modal" title={title} onClose={onClose}>
      <iframe
      title="feedback"
      id={frameId}
      src={`${feedbackFrameUrl}/centrohost?appname=ocvfeedback&feature=host-ocv-inapp-feedback&platform=web&appId=${appId}#/hostedpage`}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
    </Modal>
  )
}