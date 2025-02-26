/// <reference path="../../../../localtypings/ocv.d.ts" />
import { useEffect } from "react"
import { initFeedbackEventListener, removeFeedbackEventListener } from "./FeedbackEventListener";
import { baseConfig, ratingFeedbackConfig } from "./configs";
import { Modal } from "../Modal";

// both components require onClose because the feedback modal should close when the user clicks the "finish" button
// this would not happen if the EventListener did not have a callback to close the modal
interface IFeedbackProps  {
  kind: ocv.FeedbackKind;
  frameId: string;
  onClose?: () => void;
}

// right now, there are two kinds of feedback that I think could be valuable for our targets
// generic and rating feedback, but we will likely want to expand this
interface IFeedbackModalProps {
  kind: ocv.FeedbackKind;
  onClose: () => void;
}

// Wrapper component of the feedback modal so kind can determine what feedback actually shows in the modal
export const FeedbackModal = (props: IFeedbackModalProps) => {
  const { kind, onClose } = props;
  const title = kind === "generic" ? lf("Leave Feedback") : lf("Rate this activity");

  return (
    <Modal className="feedback-modal" title={title} onClose={onClose}>
      <>
        {kind === "generic" &&
          <Feedback
          kind={kind}
          frameId="menu-feedback-frame"
          onClose={onClose}
        />}
        {kind === "rating" &&
          <Feedback
          kind={kind}
          frameId="activity-feedback-frame"
          onClose={onClose} />
        }
      </>
    </Modal>
  )
}

export const Feedback = (props: IFeedbackProps) => {
  const { kind, frameId } = props;

  const feedbackConfig = kind === "generic" ? baseConfig : ratingFeedbackConfig;

  const onDismiss = () => {
    if (props.onClose) {
      props.onClose();
    }
  }

  let callbacks = { onDismiss };

  useEffect(() => {
    initFeedbackEventListener(feedbackConfig, frameId, callbacks);
    return () => {
        removeFeedbackEventListener();
    }
  }, [])
  return (
      <iframe
      title="feedback"
      id={frameId}
      src={`${pxt.webConfig.ocv?.iframeEndpoint}/centrohost?appname=ocvfeedback&feature=host-ocv-inapp-feedback&platform=web&appId=${pxt.webConfig.ocv?.appId}#/hostedpage`}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
  )
}