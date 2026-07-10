const OUTER_WAVE = "M42 44 C76 7 132 25 161 45 C202 8 266 25 286 59 C331 70 344 123 322 154 C350 194 325 244 286 259 C266 302 205 314 168 290 C130 320 74 301 56 264 C16 245 8 193 34 161 C12 121 14 73 42 44 Z";
const MIDDLE_WAVE = "M57 62 C87 30 132 43 160 61 C193 32 242 42 265 72 C302 84 313 124 292 154 C316 185 295 225 264 238 C244 276 198 284 166 264 C131 289 84 274 70 239 C36 222 29 183 49 157 C31 123 33 84 57 62 Z";
const INNER_WAVE = "M77 81 C101 57 132 69 160 84 C187 60 226 70 246 95 C275 106 281 133 264 156 C283 180 269 208 243 220 C225 249 187 253 163 237 C133 259 98 245 88 219 C61 205 58 176 73 155 C58 130 60 99 77 81 Z";

export default function CheomseongdaeArtwork() {
  return (
    <svg viewBox="0 0 340 320" aria-label="물결 프레임 안의 첨성대 일러스트" className="h-auto w-full" role="img">
      <defs>
        <clipPath id="cheomseongdae-wave-clip"><path d={INNER_WAVE} /></clipPath>
        <filter id="cheomseongdae-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="7" floodColor="#506260" floodOpacity="0.18" stdDeviation="6" />
        </filter>
      </defs>
      <path d={OUTER_WAVE} fill="#edf1ef" />
      <path d={MIDDLE_WAVE} fill="#d9e5e2" />
      <path d={INNER_WAVE} fill="#8eaaa6" filter="url(#cheomseongdae-shadow)" />
      <image
        clipPath="url(#cheomseongdae-wave-clip)"
        height="320"
        href="/images/cheomseongdae-paper-cut.png"
        preserveAspectRatio="xMidYMid slice"
        width="340"
      />
      <path d={OUTER_WAVE} fill="none" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="2" />
      <path d={MIDDLE_WAVE} fill="none" stroke="#f9fbfa" strokeOpacity="0.8" strokeWidth="1.5" />
    </svg>
  );
}
