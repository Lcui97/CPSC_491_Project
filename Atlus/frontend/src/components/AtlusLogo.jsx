/** PNG lives in public/ — Vite serves it at /atlus-logo.png */
const LOGO_SRC = '/atlus-logo.png';

export default function AtlusLogo({ className = '', size = 28, alt = 'Atlus' }) {
  return (
    <img
      src={LOGO_SRC}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', flexShrink: 0 }}
      draggable={false}
    />
  );
}
