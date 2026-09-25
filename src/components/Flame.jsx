export function Flame({ size = 16 }) {
  return (
    <svg className="flame" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.6 2.2c.4 3-1.3 4.6-2.8 6.2C8.2 10 6.5 11.8 6.5 14.8A5.5 5.5 0 0 0 12 20.5a5.5 5.5 0 0 0 5.5-5.7c0-2.3-1.1-3.9-2-5.1-.3 1.3-1 2.3-2 2.8.5-3.9-.1-7.3-.9-10.3z" fill="var(--mark)" />
      <path d="M12.2 12.2c-1.5 1.4-2.4 2.4-2.4 3.9a2.3 2.3 0 0 0 4.6.1c0-1.4-.9-2.4-2.2-4z" fill="#FFE7A3" />
    </svg>
  );
}
