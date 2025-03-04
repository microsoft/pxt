/// <reference path="../../../../localtypings/ocv.d.ts" />
import { useEffect } from "react"
import { initFeedbackEventListener, removeFeedbackEventListener } from "./FeedbackEventListener";
import { baseConfig, ratingFeedbackConfig } from "./configs";
import { Modal } from "../Modal";

// both components require onClose because the feedback modal should close when the user clicks the "finish" button
// this would not happen if the EventListener did not have a callback to close the modal
interface IFeedbackProps  {
  kind: ocv.FeedbackKind;
  onClose?: () => void;
}

// keeping separate props for the iframe and modal for now because we might want to expand either
// without dependencies on the other
interface IFeedbackModalProps {
  kind: ocv.FeedbackKind;
  onClose: () => void;
}

// Wrapper component of the feedback modal so kind can determine what feedback actually shows in the modal
export const FeedbackModal = (props: IFeedbackModalProps) => {
  const { kind, onClose } = props;
  const title = kind === "rating" ? lf("Rate this activity") : lf("Leave Feedback for Microsoft");

  return (
    <Modal className="feedback-modal" title={title} onClose={onClose}>
        <Feedback
          kind={kind}
          onClose={onClose}
        />
    </Modal>
  )
}

export const Feedback = (props: IFeedbackProps) => {
  const { kind, onClose } = props;

  const feedbackConfig = kind === "rating" ? ratingFeedbackConfig : baseConfig ;
  const frameId = kind === "rating" ? "activity-feedback-frame" : "menu-feedback-frame";

  const onDismiss = () => {
    if (onClose) {
      onClose();
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
    <>
     { pxt.U.ocvEnabled() &&
          <iframe
          title="feedback"
          id={frameId}
          src={`${pxt.webConfig.ocv?.iframeEndpoint}/centrohost?appname=ocvfeedback&feature=host-ocv-inapp-feedback&platform=web&appId=${pxt.webConfig.ocv?.appId}#/hostedpage`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
      }
    </>

  )
}