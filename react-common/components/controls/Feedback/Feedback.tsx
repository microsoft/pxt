import { useEffect } from "react"
import { initFeedbackEventListener, removeFeedbackEventListener } from "./FeedbackEventListener";
import { baseConfig, ratingFeedbackConfig } from "./configs";
import { Modal } from "../Modal";

interface IFeedbackModalProps {
  feedbackConfig: any;
  frameId: string;
  title: string;
  onClose: () => void;
}

interface IFeedbackProps {
  kind: "generic" | "rating";
  onClose: () => void;
}

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
    // would like to make it so there is no border on the iframe so the survey looks seamless
    <Modal className="feedback-modal" title={title} onClose={onClose}>
      <iframe
      title="feedback"
      height="450px" // You can change this according to your host app requirement
      width="550px"  // You can change this according to your host app requirement
      id={frameId}
      src={`https://admin-ignite.microsoft.com/centrohost?appname=ocvfeedback&feature=host-ocv-inapp-feedback&platform=web&appId=${appId}#/hostedpage`}
      allow="display-capture;" // This is needed if you want to use the native screenshot/screen recording feature
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
    </Modal>
  )
}