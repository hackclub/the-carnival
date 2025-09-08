import { motion } from "framer-motion";

type TentCardProps = {
  title: string;
  description: string;
  items: string[];
  accentHex: string;
};

export default function TentCard({ title, description, items, accentHex }: TentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      whileHover={{ 
        scale: 1.03, 
        rotate: [-0.5, 0.5, -0.5, 0], 
        y: -4,
        transition: { duration: 0.3 }
      }}
      className="rounded-2xl bg-white/70 backdrop-blur p-5 ring-1 ring-amber-200 shadow-sm"
    >
      <div className="flex items-start gap-4">
        <motion.svg
          width="84"
          height="64"
          viewBox="0 0 84 64"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
        >
          <defs>
            <linearGradient id="tentShade" x1="0" x2="1">
              <stop offset="0%" stopColor={accentHex} />
              <stop offset="100%" stopColor="#fef3c7" />
            </linearGradient>
          </defs>
          <rect x="2" y="54" width="80" height="4" fill="#f5deb3" opacity="0.6" />
          <motion.g animate={{ y: [0, -1.5, 0] }} transition={{ duration: 3, repeat: Infinity }}>
            <polygon points="12,54 42,18 72,54" fill="url(#tentShade)" stroke={accentHex} strokeWidth="1.5" />
            <polygon points="42,18 42,54 12,54" fill="#fff7ed" opacity="0.6" />
            <path d="M42 18 L42 54 L52 54 Z" fill="#fde68a" opacity="0.8" />
          </motion.g>
          <motion.g initial={{ y: 0 }} animate={{ y: [0, -2, 0] }} transition={{ duration: 2, repeat: Infinity }}>
            <line x1="42" y1="10" x2="42" y2="18" stroke={accentHex} strokeWidth="1.5" />
            <path d="M42 10 L56 14 L42 18 Z" fill={accentHex} />
          </motion.g>
          <motion.g animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
            <circle cx="22" cy="56" r="2" fill="#92400e" />
            <path d="M22 48 C20 52, 24 52, 22 56" fill="#f97316" />
          </motion.g>
        </motion.svg>
        <div>
          <div className="mb-2 text-lg font-semibold text-amber-900">{title}</div>
          <p className="text-sm text-amber-800">{description}</p>
          <ul className="mt-3 text-sm text-amber-700 list-disc pl-5 space-y-1">
            {items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}