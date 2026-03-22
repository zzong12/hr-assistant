export function NexusLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 4c6.6 0 12 5.4 12 12v.4c0 6.5-5.1 11.7-11.5 11.7H16C9.4 28.1 4 22.7 4 16S9.4 4 16 4Z" />
      <path d="M10.3 11.5c2.2-2.8 4.7-4.2 7.7-4.2 2.9 0 5.5 1.6 7.4 4.3" opacity="0.7" />
      <path d="M7 15.8h7.6l2.8 3 2.7-3H25" />
      <circle cx="11.2" cy="10.8" r="1.2" fill="currentColor" />
      <circle cx="20.8" cy="10.8" r="1.2" fill="currentColor" />
      <path d="M12.2 22.4h7.6" />
      <path d="M14.3 25h3.4" opacity="0.8" />
    </svg>
  );
}
