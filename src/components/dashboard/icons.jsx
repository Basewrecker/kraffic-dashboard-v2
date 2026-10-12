// Small brand marks for platforms (approximations of the live-site icons).
export function GoogleIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  )
}

const OPENAI_PATH = 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z'

const marks = {
  chatgpt: <path fill="var(--color-icon-mono)" d={OPENAI_PATH} />,
  gemini: <path fill="#4285f4" d="M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12Z" />,
  // Claude spark: 8 tapered rays
  claude: (
    <g stroke="#d97757" strokeWidth="2.6" strokeLinecap="round">
      {[0, 45, 90, 135].map((a) => <line key={a} x1="12" y1="2" x2="12" y2="22" transform={`rotate(${a} 12 12)`} />)}
    </g>
  ),
  // Grok: slashed mark (approximation)
  grok: (
    <g fill="none" stroke="var(--color-icon-mono)" strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 20 20 4" />
      <path d="M17 13.5V20M7 4a8 8 0 0 1 9 2" />
    </g>
  ),
}

// Platform marks: 16px, no background square.
export function PlatformIcon({ id, size = 16 }) {
  if (id === 'aio') return <GoogleIcon size={size} />
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      {marks[id]}
    </svg>
  )
}

// Marketplace brand marks (simplified). Brand color is the only color they carry.
export function MarketplaceIcon({ name, size = 14 }) {
  if (name === 'Target') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
        <circle cx="12" cy="12" r="11" fill="#CC0000" />
        <circle cx="12" cy="12" r="7" fill="var(--color-surface)" />
        <circle cx="12" cy="12" r="3.6" fill="#CC0000" />
      </svg>
    )
  }
  // any other store: its first letter on tint
  if (name !== 'Amazon') {
    return (
      <span aria-hidden className="grid shrink-0 place-items-center rounded-sm bg-tint font-semibold text-stone-600" style={{ width: size, height: size, fontSize: Math.round(size * 0.62) }}>
        {name?.[0]?.toUpperCase()}
      </span>
    )
  }
  // Amazon: the "smile" arrow under a lowercase a
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <text x="12" y="14.5" textAnchor="middle" fontSize="15" fontWeight="700" fontFamily="Arial, sans-serif" fill="var(--color-icon-mono)">a</text>
      <path d="M4 17.2c4.6 3 11.4 3 16 0" fill="none" stroke="#FF9900" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M17.4 15.6l2.8 1.5-1.3 2.9" fill="none" stroke="#FF9900" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
