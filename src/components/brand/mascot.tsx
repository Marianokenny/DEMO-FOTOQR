/**
 * The FOTOSQR mascot: a little hovering robot with a camera. Pure SVG, soft shading for a 3D look.
 * `mood` changes the eyes; `camera` puts the camera in its raised hand.
 */
export type MascotMood = "idle" | "focus" | "happy";

export function Mascot({ mood = "idle", cameraUp = false, flash = false, className, style }: {
  mood?: MascotMood; cameraUp?: boolean; flash?: boolean; className?: string; style?: React.CSSProperties;
}) {
  const id = "fqm"; // gradient ids are global; all mascots share the same definitions
  return (
    <svg viewBox="0 0 260 320" className={className} style={style} role="img" aria-label="Robot de FOTOSQR">
      <defs>
        <radialGradient id={`${id}-head`} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#FFFDF8" />
          <stop offset="0.55" stopColor="#F3ECE0" />
          <stop offset="1" stopColor="#D9C9AE" />
        </radialGradient>
        <radialGradient id={`${id}-body`} cx="35%" cy="25%" r="85%">
          <stop offset="0" stopColor="#FFA27E" />
          <stop offset="0.5" stopColor="#FF5B2E" />
          <stop offset="1" stopColor="#C93A12" />
        </radialGradient>
        <linearGradient id={`${id}-screen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2E2924" />
          <stop offset="1" stopColor="#0B0A08" />
        </linearGradient>
        <radialGradient id={`${id}-ball`} cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#FFD0BC" />
          <stop offset="0.45" stopColor="#FF5B2E" />
          <stop offset="1" stopColor="#B8320D" />
        </radialGradient>
        <radialGradient id={`${id}-jet`} cx="50%" cy="0%" r="100%">
          <stop offset="0" stopColor="#FFE3D6" stopOpacity="0.95" />
          <stop offset="0.4" stopColor="#FF7A4F" stopOpacity="0.7" />
          <stop offset="1" stopColor="#FF5B2E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-cam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A342E" />
          <stop offset="1" stopColor="#15120E" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* hover jet */}
      <ellipse cx="130" cy="292" rx="34" ry="30" fill={`url(#${id}-jet)`} style={{ transformOrigin: "130px 270px", animation: "fq-jet 0.35s ease-in-out infinite alternate" }} />

      {/* antenna */}
      <g style={{ transformOrigin: "130px 64px", animation: "fq-antenna 2.4s ease-in-out infinite" }}>
        <rect x="126" y="30" width="8" height="36" rx="4" fill="#3A342E" />
        <circle cx="130" cy="26" r="13" fill={`url(#${id}-ball)`} filter={`url(#${id}-glow)`} />
        <circle cx="125" cy="21" r="4" fill="#fff" opacity="0.8" />
      </g>

      {/* ears */}
      <rect x="22" y="104" width="22" height="50" rx="11" fill={`url(#${id}-body)`} />
      <rect x="216" y="104" width="22" height="50" rx="11" fill={`url(#${id}-body)`} />

      {/* head */}
      <rect x="38" y="60" width="184" height="138" rx="56" fill={`url(#${id}-head)`} />
      <path d="M70 76 C 95 64, 140 62, 168 68" stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.75" />

      {/* face screen */}
      <rect x="60" y="86" width="140" height="92" rx="38" fill={`url(#${id}-screen)`} />
      <path d="M78 100 C 92 92, 118 90, 132 92" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.14" />

      {/* eyes */}
      <g fill="#FF9D78" filter={`url(#${id}-glow)`}>
        {mood === "happy" ? (
          <>
            <path d="M88 132 Q 101 116 114 132" stroke="#FF9D78" strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M146 132 Q 159 116 172 132" stroke="#FF9D78" strokeWidth="8" strokeLinecap="round" fill="none" />
          </>
        ) : mood === "focus" ? (
          <>
            <rect x="90" y="122" width="24" height="12" rx="6" />
            <circle cx="158" cy="128" r="14" fill="none" stroke="#FF9D78" strokeWidth="5" />
            <circle cx="158" cy="128" r="5" />
          </>
        ) : (
          <g style={{ transformOrigin: "130px 128px", animation: "fq-blink 4s ease-in-out infinite" }}>
            <rect x="90" y="112" width="22" height="32" rx="11" />
            <rect x="148" y="112" width="22" height="32" rx="11" />
            <circle cx="104" cy="120" r="4" fill="#fff" opacity="0.85" />
            <circle cx="162" cy="120" r="4" fill="#fff" opacity="0.85" />
          </g>
        )}
      </g>
      {/* cheeks and mouth */}
      <ellipse cx="80" cy="152" rx="10" ry="6" fill="#FF5B2E" opacity="0.45" />
      <ellipse cx="180" cy="152" rx="10" ry="6" fill="#FF5B2E" opacity="0.45" />
      <path d={mood === "happy" ? "M118 152 Q 130 166 142 152" : "M121 156 Q 130 162 139 156"} stroke="#F3ECE0" strokeWidth="5" strokeLinecap="round" fill={mood === "happy" ? "#F3ECE0" : "none"} />

      {/* neck */}
      <rect x="112" y="196" width="36" height="14" rx="6" fill="#3A342E" />

      {/* left arm (waving side) */}
      <g style={{ transformOrigin: "86px 222px", transform: mood === "happy" ? "rotate(-120deg)" : "rotate(12deg)", transition: "transform 400ms cubic-bezier(.2,.8,.2,1)" }}>
        <rect x="58" y="214" width="34" height="18" rx="9" fill={`url(#${id}-body)`} />
        <circle cx="58" cy="223" r="12" fill={`url(#${id}-head)`} />
      </g>

      {/* body */}
      <rect x="80" y="206" width="100" height="74" rx="32" fill={`url(#${id}-body)`} />
      <path d="M98 220 C 112 213, 140 212, 156 216" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.35" />
      {/* belly badge: a tiny QR */}
      <rect x="111" y="230" width="38" height="38" rx="9" fill="#F3ECE0" />
      <g fill="#15120E">
        <rect x="116" y="235" width="10" height="10" rx="2" />
        <rect x="134" y="235" width="10" height="10" rx="2" />
        <rect x="116" y="253" width="10" height="10" rx="2" />
        <rect x="136" y="255" width="4" height="4" />
        <rect x="140" y="259" width="4" height="4" />
        <rect x="132" y="259" width="4" height="4" />
      </g>

      {/* right arm with camera */}
      <g style={{ transformOrigin: "174px 222px", transform: cameraUp ? "rotate(-58deg)" : "rotate(-8deg)", transition: "transform 450ms cubic-bezier(.2,.8,.2,1)" }}>
        <rect x="168" y="214" width="40" height="18" rx="9" fill={`url(#${id}-body)`} />
        <g transform="translate(200 202)">
          <rect x="0" y="0" width="46" height="34" rx="8" fill={`url(#${id}-cam)`} />
          <rect x="8" y="-6" width="14" height="8" rx="3" fill="#3A342E" />
          <circle cx="25" cy="17" r="11" fill="#0B0A08" stroke="#5A524A" strokeWidth="3" />
          <circle cx="22" cy="14" r="3.5" fill="#fff" opacity="0.7" />
          <circle cx="39" cy="7" r="3" fill={flash ? "#fff" : "#FF5B2E"} />
          {flash && <circle cx="39" cy="7" r="26" fill="#fff" opacity="0.85" style={{ animation: "fq-flash 500ms ease-out both" }} />}
        </g>
        <circle cx="206" cy="223" r="12" fill={`url(#${id}-head)`} />
      </g>
    </svg>
  );
}
