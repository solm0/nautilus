import { forwardRef, useId } from "react";
import logoSource from "../components/svgs/logo.svg?raw";

const logoPath = logoSource.match(/<path[^>]*d="([^"]+)"/)?.[1];

if (!logoPath) {
  throw new Error("logo.svg does not contain a path");
}

const waveAreaPath = [
  "M -12 0",
  "C -8 -3 -4 -3 0 0",
  "S 8 3 12 0",
  "S 20 -3 24 0",
  "S 32 3 36 0",
  "S 44 -3 48 0",
  "S 56 3 60 0",
  "L 60 60",
  "L -12 60",
  "Z",
].join(" ");

const waveLinePath = [
  "M -12 0",
  "C -8 -3 -4 -3 0 0",
  "S 8 3 12 0",
  "S 20 -3 24 0",
  "S 32 3 36 0",
  "S 44 -3 48 0",
  "S 56 3 60 0",
].join(" ");

const ScrollFillLogo = forwardRef<SVGGElement>(function ScrollFillLogo(_, ref) {
  const instanceId = useId().replaceAll(":", "");
  const clipId = `landing-logo-clip-${instanceId}`;
  const gradientId = `landing-logo-gradient-${instanceId}`;
  const blurId = `landing-logo-blur-${instanceId}`;

  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="Nautilus"
      className="block size-full overflow-visible"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={logoPath} />
        </clipPath>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="9" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2e3aff" stopOpacity="0.48" />
          <stop offset="0.72" stopColor="#2e3aff" />
        </linearGradient>
        <filter id={blurId} x="-20%" y="-300%" width="140%" height="700%">
          <feGaussianBlur stdDeviation="1.35" />
        </filter>
      </defs>

      <path d={logoPath} fill="#191715" />

      <g clipPath={`url(#${clipId})`}>
        <g
          ref={ref}
          className="landing-logo__water"
          style={{ transform: "translateY(48px)" }}
        >
          <g className="landing-logo__wave">
            <path d={waveAreaPath} fill={`url(#${gradientId})`} />
            <path
              d={waveLinePath}
              fill="none"
              stroke="#2e3aff"
              strokeWidth="2.6"
              filter={`url(#${blurId})`}
              opacity="0.7"
            />
          </g>
        </g>
      </g>
    </svg>
  );
});

export default ScrollFillLogo;
