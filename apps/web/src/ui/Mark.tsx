export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#141a3f" stroke="#2b3163" />
      <rect x="9" y="7" width="3.5" height="18" rx="1.75" fill="#ff7a8a" />
      <rect x="17" y="10" width="3.5" height="15" rx="1.75" fill="#4fdcf7" />
      <rect x="20.5" y="21.5" width="4.5" height="3.5" rx="1.75" fill="#4fdcf7" />
    </svg>
  );
}
