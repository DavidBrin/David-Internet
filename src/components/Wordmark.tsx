/**
 * The "David" wordmark in Google's letter colours.
 * Rendered as styled text (not an image) so it scales with font-size and stays
 * selectable/searchable; the font stack falls back to a rounded grotesque.
 */

/** Google's brand sequence applied to D-a-v-i-d. */
const LETTERS: ReadonlyArray<readonly [string, string]> = [
  ["D", "#4285F4"],
  ["a", "#EA4335"],
  ["v", "#FBBC05"],
  ["i", "#4285F4"],
  ["d", "#34A853"],
];

interface WordmarkProps {
  /** CSS font-size; the wordmark is sized entirely by type. */
  size?: number | string;
  className?: string;
  /** Accessible name for the mark. Defaults to "David". */
  title?: string;
}

export default function Wordmark({ size, className, title = "David" }: WordmarkProps) {
  return (
    <span
      className={className ? `wordmark ${className}` : "wordmark"}
      style={size ? { fontSize: typeof size === "number" ? `${size}px` : size } : undefined}
      role="img"
      aria-label={title}
    >
      {LETTERS.map(([letter, color], i) => (
        <span key={`${letter}-${i}`} style={{ color }} aria-hidden="true">
          {letter}
        </span>
      ))}
    </span>
  );
}
