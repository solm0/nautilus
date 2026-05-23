export default function PruneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      className={className}
    >
      <circle cx="4" cy="4" r="3" />
      <path d="M19,4H7c4.97,0,9,4.03,9,9" />
      <path d="M17.95,19l-3.88-3.88" />
      <path d="M14.07,19l3.88-3.88" />
    </svg>
  );
}