import type { IconName } from '../types'

export function Icon({ name }: { name: IconName }): React.JSX.Element {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  }

  switch (name) {
    case 'book':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21Z" />
          <path d="M5 5.5V21" />
          <path d="M9 7h6" />
          <path d="M9 11h6" />
        </svg>
      )
    case 'kindle':
      return (
        <svg {...common} aria-hidden="true">
          <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
          <path d="M10 6.5h4" />
          <path d="M9.5 17h5" />
        </svg>
      )
    case 'login':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M20 6v5h-5" />
          <path d="M4 18v-5h5" />
          <path d="M7.5 8A7 7 0 0 1 20 11" />
          <path d="M16.5 16A7 7 0 0 1 4 13" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" />
          <path d="M19 12a7.4 7.4 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-1.8-1L14.5 3h-5l-.2 2.9a7.6 7.6 0 0 0-1.8 1l-2.4-1-2 3.5 2 1.5a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 0 0 1.8 1l.2 2.9h5l.2-2.9a7.6 7.6 0 0 0 1.8-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z" />
        </svg>
      )
    case 'stethoscope':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M8 4v5a4 4 0 0 0 8 0V4" />
          <path d="M8 4H6" />
          <path d="M16 4h2" />
          <path d="M12 13v3a4 4 0 0 0 8 0a2 2 0 1 0-4 0" />
        </svg>
      )
    case 'save':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M5 4h11l3 3v13H5Z" />
          <path d="M8 4v5h7V4" />
          <path d="M8 20v-6h8v6" />
        </svg>
      )
    case 'download':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 4v10" />
          <path d="m8 10 4 4 4-4" />
          <path d="M5 19h14" />
        </svg>
      )
    case 'trash':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 7h16" />
          <path d="M9 3h6" />
          <path d="M7 7l1 13h8l1-13" />
          <path d="M10 11v5" />
          <path d="M14 11v5" />
        </svg>
      )
    case 'play':
      return (
        <svg {...common} aria-hidden="true">
          <path d="m8 5 10 7-10 7Z" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'stop':
      return (
        <svg {...common} aria-hidden="true">
          <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="11" cy="11" r="5.5" />
          <path d="m16 16 4 4" />
        </svg>
      )
    case 'globe':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18" />
          <path d="M12 3a14 14 0 0 0 0 18" />
        </svg>
      )
    case 'github':
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
      )
  }
}
