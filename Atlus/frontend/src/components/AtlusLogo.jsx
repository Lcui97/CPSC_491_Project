/** Served from `public/atlus-logo.png` (Vite root). */
const LOGO_SRC = '/atlus-logo.png';

export default function AtlusLogo({ className = '', size = 28, alt = 'Atlus' }) {
  return (
    <img
      src={LOGO_SRC}
      alt={alt}
      width={size}
      height={size}
      className={`object-contain shrink-0 ${className}`}
      draggable={false}
    />
  );
}
