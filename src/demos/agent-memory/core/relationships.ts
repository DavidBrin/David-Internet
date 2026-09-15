interface MemoryIdentity {
  memory_id: string;
}

interface GraphRelationship {
  src: string;
  dst: string;
  rel: string;
}

const CARD_START_Y = 72;
const CARD_HEIGHT = 88;
const CARD_STEP_Y = 112;

export function supersedesArrow(records: MemoryIdentity[], edges: GraphRelationship[]) {
  const edge = edges.find((candidate) => candidate.rel === "supersedes");
  if (!edge) return null;

  const sourceIndex = records.findIndex((record) => edge.src === `mem:${record.memory_id}`);
  const targetIndex = records.findIndex((record) => edge.dst === `mem:${record.memory_id}`);
  if (sourceIndex < 0 || targetIndex < 0) return null;

  const sourceY = CARD_START_Y + sourceIndex * CARD_STEP_Y;
  const targetY = CARD_START_Y + targetIndex * CARD_STEP_Y;
  return sourceY < targetY
    ? { startY: sourceY + CARD_HEIGHT, endY: targetY }
    : { startY: sourceY, endY: targetY + CARD_HEIGHT };
}
