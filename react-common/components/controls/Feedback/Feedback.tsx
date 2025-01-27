import { useEffect } from "react"
import { initFeedbackEventListener, removeFeedbackEventListener } from "./FeedbackEventListener";
import { baseConfig, ratingFeedbackConfig } from "./configs";
import { Modal } from "../Modal";

// both components require onClose because the feedback modal should close when the user clicks the "finish" button
// this would not happen if the EventListener did not have a callback to close the modal
interface IFeedbackModalProps {
  feedbackConfig: any;
  frameId: string;
  title: string;
  onClose: () => void;
}

// right now, there are two kinds of feedback that I think could be valuable for our targets
// generic and rating feedback, but we will likely want to expand this
interface IFeedbackProps {
  kind: "generic" | "rating";
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
        onClose={props.onClose}
      />}
      {kind === "rating" &&
        <FeedbackModal
        feedbackConfig={ratingFeedbackConfig}
        frameId="activity-feedback-frame"
        title={lf("Rate this activity")}
        onClose={props.onClose} />
      }
    </>
  )
}

export const FeedbackModal = (props: IFeedbackModalProps) => {
  const { feedbackConfig, frameId, title, onClose } = props;
  const appId = 50315;

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
      height="450px"
      width="550px"
      id={frameId}
      src={`https://admin-ignite.microsoft.com/centrohost?appname=ocvfeedback&feature=host-ocv-inapp-feedback&platform=web&appId=${appId}#/hostedpage`}
      allow="display-capture;" // This is needed if you want to use the native screenshot/screen recording feature
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
    </Modal>
  )
}