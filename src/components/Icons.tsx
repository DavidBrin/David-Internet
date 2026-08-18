/**
 * Inline SVG icons, traced from Google's Material set. No icon-font dependency.
 * Every icon is decorative by default (aria-hidden) — callers supply the label.
 */

interface IconProps {
  size?: number;
  className?: string;
}

export function MagnifierIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      focusable="false"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
  );
}

export function MicIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      focusable="false"
      aria-hidden="true"
    >
      <path fill="#4285f4" d="m12 15c1.66 0 3-1.31 3-2.97v-7.02c0-1.66-1.34-3.01-3-3.01s-3 1.34-3 3.01v7.02c0 1.66 1.34 2.97 3 2.97z" />
      <path fill="#34a853" d="m11 18.08h2v3.92h-2z" />
      <path
        fill="#fbbc05"
        d="m7.05 16.87c-1.27-1.33-2.05-2.83-2.05-4.87h2c0 1.45 0.56 2.42 1.47 3.38v0.32l-1.15 1.15z"
      />
      <path
        fill="#ea4335"
        d="m12 16.93a4.97 5.25 0 0 1 -3.54 -1.55l-1.41 1.49c1.26 1.34 3.02 2.13 4.95 2.13 3.87 0 6.99-2.92 6.99-7h-1.99c0 2.92-2.24 4.93-5 4.93z"
      />
    </svg>
  );
}

/** The 3x3 apps grid. */
export function AppsGridIcon({ size = 24, className }: IconProps) {
  const dots = [
    [5, 5],
    [12, 5],
    [19, 5],
    [5, 12],
    [12, 12],
    [19, 12],
    [5, 19],
    [12, 19],
    [19, 19],
  ];
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      focusable="false"
      aria-hidden="true"
      fill="currentColor"
    >
      {dots.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" />
      ))}
    </svg>
  );
}

export function CloseIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      focusable="false"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}

/** Tab-row icons. */
export function AllIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      focusable="false"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
  );
}

export function ImagesIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      focusable="false"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
    </svg>
  );
}

export function VideosIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      focusable="false"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
    </svg>
  );
}

export function PlayIcon({ size = 28, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      focusable="false"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
