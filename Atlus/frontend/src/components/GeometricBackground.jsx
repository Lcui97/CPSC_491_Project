export default function GeometricBackground({ children }) {
  return (
    <div className="geom-wrap">
      <div className="geom-bg-solid" />

      <svg
        className="geom-grid-svg"
        viewBox="0 0 100 100"
        fill="none"
        stroke="#59524F"
        strokeWidth="0.5"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={`v${i}`} x1={i * 20} y1={0} x2={i * 20} y2={100} />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={`h${i}`} x1={0} y1={i * 20} x2={100} y2={i * 20} />
        ))}
      </svg>

      <svg
        className="geom-poly-tr"
        viewBox="0 0 400 300"
        preserveAspectRatio="xMaxYMin slice"
      >
        <defs>
          <linearGradient id="gradient-polygon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F5D547" />
            <stop offset="50%" stopColor="#F4A261" />
            <stop offset="100%" stopColor="#E76F51" />
          </linearGradient>
        </defs>
        <polygon
          points="400,0 400,200 100,300 0,250 0,0"
          fill="url(#gradient-polygon)"
        />
      </svg>

      <svg
        className="geom-poly-br"
        viewBox="0 0 400 400"
        preserveAspectRatio="xMaxYMax slice"
      >
        <polygon
          points="400,400 400,150 250,50 50,150 0,400"
          fill="#59524F"
        />
      </svg>

      <svg
        className="geom-mid-svg"
        viewBox="0 0 200 200"
        fill="none"
        stroke="#59524F"
        strokeWidth="0.8"
      >
        <ellipse cx="100" cy="100" rx="80" ry="40" strokeDasharray="4 2" />
        <ellipse cx="100" cy="100" rx="60" ry="30" strokeDasharray="3 2" transform="rotate(-15 100 100)" />
        <path d="M 20 100 Q 100 40 180 100 T 20 100" strokeDasharray="2 2" />
      </svg>

      <div className="geom-content">{children}</div>
    </div>
  );
}
