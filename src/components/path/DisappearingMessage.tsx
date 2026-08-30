/**
 * DisappearingMessage — a short line etched in sand beside the river that the
 * passing water washes away. Driven purely by its own --sp scroll progress:
 * etched in while approaching, swept + dissolved once the wet edge passes.
 * The fixed anchor line uses AnchorEtch instead (it lingers).
 */
import type { DisappearingMessage as Msg } from "@/lib/journey";

export default function DisappearingMessage({ message }: { message: Msg }) {
  return (
    <aside className="washMessage" data-progress aria-label="etched note">
      <span className="washMessage-text">{message.text}</span>
      <span className="washMessage-sweep" aria-hidden="true" />
    </aside>
  );
}
