export function NexusLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="5" cy="5" r="1.5" />
      <circle cx="19" cy="5" r="1.5" />
      <circle cx="19" cy="19" r="1.5" />
      <circle cx="5" cy="19" r="1.5" />
      <line x1="9.5" y1="9.5" x2="6.2" y2="6.2" />
      <line x1="14.5" y1="9.5" x2="17.8" y2="6.2" />
      <line x1="14.5" y1="14.5" x2="17.8" y2="17.8" />
      <line x1="9.5" y1="14.5" x2="6.2" y2="17.8" />
      <circle cx="12" cy="12" r="10" strokeDasharray="3 3" opacity="0.3" />
    </svg>
  );
}
