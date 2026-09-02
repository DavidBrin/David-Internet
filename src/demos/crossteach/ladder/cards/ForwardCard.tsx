"use client";

/**
 * End-of-strip card pointing forward to the exchange panel. Plain anchor
 * navigation only -- never a scripted scroll.
 */
export default function ForwardCard() {
  return (
    <article className="ctLCard ctLForwardCard" role="listitem">
      <p className="ctLForwardText">
        Autodiff, FFNs, CNNs, RNNs, autoencoders -- the ladder&apos;s last rung is the
        group project.
      </p>
      <a href="#exchange" className="ctBtn ctBtnPrimary ctLForwardLink">
        {"-> the final project"}
      </a>
    </article>
  );
}
