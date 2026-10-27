// Жұсақ — the fox mascot (SVG). Moods: happy, thinking, celebrating.
type Mood = 'happy' | 'thinking' | 'celebrate';

export default function Mascot({ mood = 'happy', size = 'medium', className = '' }: {
  mood?: Mood; size?: 'small' | 'medium' | 'big'; className?: string;
}) {
  const anim = mood === 'celebrate' ? 'mood-celebrate' : mood === 'thinking' ? '' : 'mood-bounce';
  const sizeCls = size === 'small' ? 'small' : size === 'big' ? 'big' : '';
  return (
    <div className={`mascot-wrap`}>
      <svg
        viewBox="0 0 200 200"
        className={`mascot ${sizeCls} ${anim}`}
        role="img"
        aria-label={mood === 'celebrate' ? 'Жұсақ қуанып тұр' : mood === 'thinking' ? 'Жұсақ ойлануда' : 'Жұсақ сәлемдесуде'}
      >
        {/* tail */}
        <path d="M138 158 Q178 148 172 112 Q170 100 160 104 Q166 130 132 140 Z" fill="#F97316" />
        <path d="M166 116 Q172 108 160 104 Q163 122 146 132 Q160 128 166 116 Z" fill="#FFF7ED" />
        {/* body */}
        <ellipse cx="100" cy="152" rx="44" ry="36" fill="#F97316" />
        <ellipse cx="100" cy="160" rx="27" ry="23" fill="#FFF7ED" />
        {/* paws */}
        {mood === 'celebrate' ? (
          <>
            <path d="M64 138 Q46 118 50 100" stroke="#F97316" strokeWidth="14" strokeLinecap="round" fill="none" />
            <path d="M136 138 Q154 118 150 100" stroke="#F97316" strokeWidth="14" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <ellipse cx="72" cy="184" rx="13" ry="9" fill="#FDBA74" />
            <ellipse cx="128" cy="184" rx="13" ry="9" fill="#FDBA74" />
          </>
        )}
        {/* ears */}
        <path d="M62 58 L44 14 L88 38 Z" fill="#F97316" />
        <path d="M138 58 L156 14 L112 38 Z" fill="#F97316" />
        <path d="M62 48 L52 26 L80 40 Z" fill="#7C2D12" />
        <path d="M138 48 L148 26 L120 40 Z" fill="#7C2D12" />
        {/* head */}
        <circle cx="100" cy="86" r="45" fill="#F97316" />
        {/* cheeks */}
        <circle cx="74" cy="98" r="17" fill="#FFF7ED" />
        <circle cx="126" cy="98" r="17" fill="#FFF7ED" />
        {/* eyes */}
        {mood === 'celebrate' ? (
          <>
            <path d="M74 82 Q81 74 88 82" stroke="#1F2937" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M112 82 Q119 74 126 82" stroke="#1F2937" strokeWidth="5" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <circle cx="81" cy="82" r="6.5" fill="#1F2937" />
            <circle cx="119" cy="82" r="6.5" fill="#1F2937" />
            <circle cx="83" cy="80" r="2" fill="#fff" />
            <circle cx="121" cy="80" r="2" fill="#fff" />
            {mood === 'thinking' && (
              <>
                <path d="M72 70 Q81 66 90 70" stroke="#7C2D12" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                <path d="M110 70 Q119 66 128 70" stroke="#7C2D12" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              </>
            )}
          </>
        )}
        {/* snout */}
        <ellipse cx="100" cy="104" rx="15" ry="11" fill="#FFF7ED" />
        <circle cx="100" cy="99" r="4.5" fill="#1F2937" />
        {mood === 'celebrate' ? (
          <path d="M90 108 Q100 120 110 108" stroke="#1F2937" strokeWidth="4" strokeLinecap="round" fill="none" />
        ) : mood === 'thinking' ? (
          <circle cx="100" cy="111" r="3.5" fill="#1F2937" />
        ) : (
          <path d="M92 108 Q100 115 108 108" stroke="#1F2937" strokeWidth="4" strokeLinecap="round" fill="none" />
        )}
        {/* Kazakh hat: white crown, red tip, gold band */}
        <ellipse cx="100" cy="47" rx="36" ry="9" fill="#FFF7ED" stroke="#FCD34D" strokeWidth="3" />
        <path d="M70 45 Q100 8 130 45 Z" fill="#EF4444" />
        <circle cx="100" cy="14" r="5" fill="#FCD34D" />
        {/* hat ornament (simplified qoshar-muiz) */}
        <path d="M86 40 Q86 32 93 32 Q98 32 98 37" stroke="#FCD34D" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M114 40 Q114 32 107 32 Q102 32 102 37" stroke="#FCD34D" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {mood === 'thinking' && (
          <g>
            <circle cx="152" cy="40" r="12" fill="var(--surface,#fff)" stroke="#FCD34D" strokeWidth="2.5" />
            <text x="152" y="46" textAnchor="middle" fontSize="15" fontWeight="900" fill="#B45309">?</text>
            <circle cx="163" cy="22" r="4.5" fill="var(--surface,#fff)" stroke="#FCD34D" strokeWidth="2" />
            <circle cx="172" cy="12" r="3" fill="var(--surface,#fff)" stroke="#FCD34D" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
}
