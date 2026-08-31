"use client";

import DecryptPanel from "./decrypt/DecryptPanel";
import EchoPanel from "./echo/EchoPanel";
import DeblurPanel from "./deblur/DeblurPanel";
import AliasingPanel from "./aliasing/AliasingPanel";
import CartpolePanel from "./cartpole/CartpolePanel";
import "./signals.css";

export default function SignalsStage() {
  return (
    <>
      <section className="demoPanel" id="decrypt">
        <div className="demoPanelHead">
          <h2>Lab 1 — Decrypt the message</h2>
          <p>an encrypted speech signal: magnitude/phase packing, split halves, and a seeded permutation, undone one step at a time</p>
        </div>
        <DecryptPanel />
      </section>

      <section className="demoPanel" id="echo">
        <div className="demoPanelHead">
          <h2>Lab 2 — Echo cancellation</h2>
          <p>find N and α in the autocorrelation, invert the room with an IIR filter, and mind the unit circle</p>
        </div>
        <EchoPanel />
      </section>

      <section className="demoPanel" id="deblur">
        <div className="demoPanelHead">
          <h2>Lab 3 — Image deblurring</h2>
          <p>a moving-average blur as a Toeplitz matrix, inverted with a pseudoinverse — and why inverses are fragile</p>
        </div>
        <DeblurPanel />
      </section>

      <section className="demoPanel" id="aliasing">
        <div className="demoPanelHead">
          <h2>Lab 4 — Aliasing</h2>
          <p>undersample a sinusoid and a chirp, and hear frequencies fold at Nyquist</p>
        </div>
        <AliasingPanel />
      </section>

      <section className="demoPanel" id="cartpole">
        <div className="demoPanelHead">
          <h2>Lab 5 — Stick balancing</h2>
          <p>an unstable system made stable: drag the feedback gains and watch the poles cross into the left half-plane</p>
        </div>
        <CartpolePanel />
      </section>
    </>
  );
}
