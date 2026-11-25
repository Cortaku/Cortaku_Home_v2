// The robot as a 16px pixel face.
export default function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={className} aria-hidden="true">
      <rect width="16" height="16" rx="3" fill="var(--accent)" />
      <rect x="5" y="1" width="3" height="1" fill="#211d38" />
      <rect x="8" y="2" width="1" height="2" fill="#211d38" />
      <rect x="2" y="4" width="12" height="10" fill="#211d38" />
      <rect x="3" y="5" width="10" height="8" fill="#8a8590" />
      <rect x="3" y="5" width="2" height="8" fill="#6b6a6d" />
      <rect x="6" y="6" width="6" height="6" fill="#9bb0bd" />
      <rect x="7" y="7" width="1" height="1" fill="#211d38" />
      <rect x="10" y="7" width="1" height="1" fill="#211d38" />
      <rect x="7" y="9" width="1" height="1" fill="#211d38" />
      <rect x="10" y="9" width="1" height="1" fill="#211d38" />
      <rect x="8" y="10" width="2" height="1" fill="#211d38" />
    </svg>
  );
}
