import { useI18n } from "../i18n/LanguageProvider";

const OUTER_WAVE = "M43 46 C75 12 121 20 159 43 C198 12 257 23 284 61 C323 77 335 124 313 157 C337 194 319 244 282 263 C263 310 211 334 169 310 C128 339 73 319 56 275 C17 254 8 204 32 167 C8 126 15 76 43 46 Z";
const MIDDLE_WAVE = "M57 62 C87 34 126 38 159 59 C193 33 242 42 267 74 C302 88 313 128 292 158 C313 190 297 230 265 248 C247 288 207 310 168 289 C132 315 88 297 72 260 C40 241 33 200 52 169 C31 132 36 91 57 62 Z";
const INNER_WAVE = "M73 80 C99 57 129 58 159 77 C190 54 229 62 251 91 C280 105 289 136 272 162 C291 190 278 222 251 237 C235 269 201 288 167 272 C137 294 101 279 88 249 C62 234 57 202 72 176 C55 146 57 105 73 80 Z";

export default function CheomseongdaeArtwork() {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 340 350" aria-label={t("intro.artworkLabel")} className="h-auto w-full overflow-visible" role="img">
      <defs>
        <clipPath id="cheomseongdae-wave-clip">
          <path d={INNER_WAVE} />
        </clipPath>
        <radialGradient id="cheomseongdae-image-blend" gradientUnits="userSpaceOnUse" cx="170" cy="169" r="142">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="76%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <mask id="cheomseongdae-image-mask" maskUnits="userSpaceOnUse" x="48" y="38" width="244" height="276">
          <path d={INNER_WAVE} fill="url(#cheomseongdae-image-blend)" />
        </mask>
        <filter id="cheomseongdae-paper" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence baseFrequency="0.045" numOctaves="3" seed="8" type="fractalNoise" result="paperNoise" />
          <feColorMatrix in="paperNoise" type="saturate" values="0" result="paperMono" />
          <feComponentTransfer in="paperMono" result="paperGrain">
            <feFuncA type="table" tableValues="0 0.18" />
          </feComponentTransfer>
          <feComposite in="paperGrain" in2="SourceGraphic" operator="in" result="paperTexture" />
          <feBlend in="SourceGraphic" in2="paperTexture" mode="soft-light" />
        </filter>
        <filter id="cheomseongdae-inner-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="5" floodColor="#2f4a4d" floodOpacity="0.2" stdDeviation="5" />
        </filter>
        <linearGradient id="cheomseongdae-wave-outer-gradient" x1="0" y1="1" x2="0.8" y2="0">
          <stop className="cheomseongdae-wave-tone cheomseongdae-wave-tone--outer-start" offset="0%" stopColor="#e1f2f8" />
          <stop className="cheomseongdae-wave-tone cheomseongdae-wave-tone--outer-end" offset="100%" stopColor="#fbfdfe" />
        </linearGradient>
        <linearGradient id="cheomseongdae-wave-middle-gradient" x1="0.1" y1="1" x2="0.85" y2="0.05">
          <stop className="cheomseongdae-wave-tone cheomseongdae-wave-tone--middle-start" offset="0%" stopColor="#bfdfeb" />
          <stop className="cheomseongdae-wave-tone cheomseongdae-wave-tone--middle-end" offset="100%" stopColor="#edf8fb" />
        </linearGradient>
        <linearGradient id="cheomseongdae-wave-inner-gradient" x1="0.15" y1="1" x2="0.8" y2="0">
          <stop className="cheomseongdae-wave-tone cheomseongdae-wave-tone--inner-start" offset="0%" stopColor="#8fc6d9" />
          <stop className="cheomseongdae-wave-tone cheomseongdae-wave-tone--inner-end" offset="100%" stopColor="#d7edf4" />
        </linearGradient>
      </defs>

      <g className="cheomseongdae-wave cheomseongdae-wave--outer" filter="url(#cheomseongdae-paper)">
        <path d={OUTER_WAVE} fill="url(#cheomseongdae-wave-outer-gradient)" />
        <path d={OUTER_WAVE} fill="none" stroke="#ffffff" strokeOpacity="0.92" strokeWidth="2" />
      </g>
      <g className="cheomseongdae-wave cheomseongdae-wave--middle">
        <path d={MIDDLE_WAVE} fill="url(#cheomseongdae-wave-middle-gradient)" />
        <path d={MIDDLE_WAVE} fill="none" stroke="#f9fcfb" strokeOpacity="0.82" strokeWidth="1.7" />
      </g>
      <g className="cheomseongdae-wave cheomseongdae-wave--inner" filter="url(#cheomseongdae-inner-shadow)">
        <path d={INNER_WAVE} fill="url(#cheomseongdae-wave-inner-gradient)" />
      </g>

      <image
        className="cheomseongdae-scene cheomseongdae-scene--day"
        clipPath="url(#cheomseongdae-wave-clip)"
        height="272.5"
        href="/images/cheomseongdae-paper-cut-day.webp"
        mask="url(#cheomseongdae-image-mask)"
        preserveAspectRatio="xMidYMid meet"
        width="218"
        x="61"
        y="35"
      />
      <image
        className="cheomseongdae-scene cheomseongdae-scene--night"
        clipPath="url(#cheomseongdae-wave-clip)"
        height="272.5"
        href="/images/cheomseongdae-paper-cut-night.webp"
        mask="url(#cheomseongdae-image-mask)"
        preserveAspectRatio="xMidYMid meet"
        width="218"
        x="61"
        y="35"
      />
    </svg>
  );
}
