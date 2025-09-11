type FaqTentProps = { q: string; a: string; accent: string };

export default function FaqTent({ q, a, accent }: FaqTentProps) {
  return (
    <details
      className="group rounded-2xl bg-white/70 backdrop-blur p-5 ring-1 ring-amber-200 shadow-sm transition-transform hover:-translate-y-0.5 hover:rotate-[0.5deg]"
    >
      <summary className="list-none cursor-pointer flex items-start gap-4">
        <svg
          width="64"
          height="48"
          viewBox="0 0 84 64"
          xmlns="http://www.w3.org/2000/svg"
          className="mt-0.5"
        >
          <rect x="2" y="42" width="80" height="4" fill="#f5deb3" opacity="0.6" />
          <g>
            <polygon points="12,42 42,18 72,42" fill={accent} opacity="0.75" />
            <polygon points="42,18 42,42 12,42" fill="#fff7ed" opacity="0.6" />
          </g>
          <g>
            <line x1="42" y1="12" x2="42" y2="18" stroke={accent} strokeWidth="1.5" />
            <path d="M42 12 L54 15 L42 18 Z" fill={accent} />
          </g>
        </svg>
        <div className="flex-1">
          <h4 className="text-amber-900 font-semibold">{q}</h4>
          <p className="text-amber-700 text-sm mt-2 group-open:mt-2 hidden group-open:block">{a}</p>
        </div>
      </summary>
    </details>
  );
}