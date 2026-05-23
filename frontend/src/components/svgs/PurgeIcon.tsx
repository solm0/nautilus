export default function PurgeIcon({ className }: { className?: string }) {
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
      <circle cx="4" cy="4" r="3"/>
      <path d="M13.1,4h-6.1c4.97,0,6.28,4.03,6.28,9"/>
      <path d="M15.22,19l-3.88-3.88"/>
      <path d="M11.34,19l3.88-3.88"/>
      <path d="M19,5.94l-3.88-3.88"/>
      <path d="M15.12,5.94l3.88-3.88"/>
    </svg>
  );
}