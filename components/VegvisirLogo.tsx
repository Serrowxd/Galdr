type VegvisirLogoProps = {
  size?: number;
  className?: string;
};

export function VegvisirLogo({ size = 40, className }: VegvisirLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <circle cx="50" cy="50" r="6" className="logo-stroke" fill="none" />
      <circle cx="50" cy="50" r="2" fill="currentColor" />
      <circle cx="50" cy="50" r="18" className="logo-stroke-thin" fill="none" />
      <circle cx="50" cy="50" r="35" className="logo-stroke-thin" fill="none" />
      <circle
        cx="50"
        cy="50"
        r="45"
        className="logo-stroke-dashed"
        fill="none"
        strokeDasharray="4 2"
      />

      <line x1="50" y1="5" x2="50" y2="32" className="logo-stroke" />
      <line x1="50" y1="5" x2="46" y2="12" className="logo-stroke-thin" />
      <line x1="50" y1="5" x2="54" y2="12" className="logo-stroke-thin" />

      <line x1="50" y1="68" x2="50" y2="95" className="logo-stroke" />
      <line x1="50" y1="95" x2="46" y2="88" className="logo-stroke-thin" />
      <line x1="50" y1="95" x2="54" y2="88" className="logo-stroke-thin" />

      <line x1="68" y1="50" x2="95" y2="50" className="logo-stroke" />
      <line x1="95" y1="50" x2="88" y2="46" className="logo-stroke-thin" />
      <line x1="95" y1="50" x2="88" y2="54" className="logo-stroke-thin" />

      <line x1="5" y1="50" x2="32" y2="50" className="logo-stroke" />
      <line x1="5" y1="50" x2="12" y2="46" className="logo-stroke-thin" />
      <line x1="5" y1="50" x2="12" y2="54" className="logo-stroke-thin" />

      <line x1="62.7" y1="37.3" x2="81.8" y2="18.2" className="logo-stroke" />
      <line
        x1="81.8"
        y1="18.2"
        x2="74"
        y2="20"
        className="logo-stroke-thin"
      />
      <line
        x1="81.8"
        y1="18.2"
        x2="80"
        y2="26"
        className="logo-stroke-thin"
      />

      <line x1="37.3" y1="37.3" x2="18.2" y2="18.2" className="logo-stroke" />
      <line
        x1="18.2"
        y1="18.2"
        x2="26"
        y2="20"
        className="logo-stroke-thin"
      />
      <line
        x1="18.2"
        y1="18.2"
        x2="20"
        y2="26"
        className="logo-stroke-thin"
      />

      <line x1="62.7" y1="62.7" x2="81.8" y2="81.8" className="logo-stroke" />
      <line
        x1="81.8"
        y1="81.8"
        x2="74"
        y2="80"
        className="logo-stroke-thin"
      />
      <line
        x1="81.8"
        y1="81.8"
        x2="80"
        y2="74"
        className="logo-stroke-thin"
      />

      <line x1="37.3" y1="62.7" x2="18.2" y2="81.8" className="logo-stroke" />
      <line
        x1="18.2"
        y1="81.8"
        x2="26"
        y2="80"
        className="logo-stroke-thin"
      />
      <line
        x1="18.2"
        y1="81.8"
        x2="20"
        y2="74"
        className="logo-stroke-thin"
      />

      <circle cx="50" cy="5" r="2" fill="currentColor" />
      <circle cx="50" cy="95" r="2" fill="currentColor" />
      <circle cx="5" cy="50" r="2" fill="currentColor" />
      <circle cx="95" cy="50" r="2" fill="currentColor" />
    </svg>
  );
}
