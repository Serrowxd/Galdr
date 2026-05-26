type VegvisirLogoProps = {
  size?: number;
  className?: string;
};

/**
 * A spare runic mark: a vertical stave with two arms forking outward at the top.
 * Renders as a single-color stroked SVG that picks up `currentColor`.
 */
export function VegvisirLogo({ size = 22, className }: VegvisirLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <line
        x1="11"
        y1="2"
        x2="11"
        y2="20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="11"
        y1="7"
        x2="5"
        y2="13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="11"
        y1="7"
        x2="17"
        y2="13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
