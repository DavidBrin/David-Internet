interface ChapterAnchor {
  focus(options: FocusOptions): void;
  scrollIntoView(options: ScrollIntoViewOptions): void;
}

interface ChapterDocument {
  getElementById(id: string): ChapterAnchor | null;
}

export function focusChapterAnchor(anchor: string, documentLike: ChapterDocument = document): boolean {
  const target = documentLike.getElementById(anchor);
  if (!target) return false;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start" });
  return true;
}
