// Простые иконки в виде SVG — без сторонних библиотек.
const base = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconCalendar = () => (
  <svg {...base}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

export const IconList = () => (
  <svg {...base}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="18" r="1" />
  </svg>
);

export const IconDumbbell = () => (
  <svg {...base}>
    <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
  </svg>
);

export const IconChart = () => (
  <svg {...base}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const IconBack = () => (
  <svg {...base}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const IconPlus = () => (
  <svg {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconSearch = () => (
  <svg {...base} width={20} height={20}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const IconClose = ({ size = 22 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconUp = () => (
  <svg {...base} width={22} height={22}>
    <path d="M6 15l6-6 6 6" />
  </svg>
);

export const IconDown = () => (
  <svg {...base} width={22} height={22}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconCheck = ({ size = 22 }: { size?: number }) => (
  <svg {...base} width={size} height={size} strokeWidth={3}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

/** Облако со стрелкой — резервная копия */
export const IconBackup = () => (
  <svg {...base}>
    <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5" />
    <path d="M12 12v8M9 15l3-3 3 3" />
  </svg>
);

/** «Ручка» для перетаскивания — шесть точек */
export const IconGrip = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="9" cy="6" r="1.7" />
    <circle cx="15" cy="6" r="1.7" />
    <circle cx="9" cy="12" r="1.7" />
    <circle cx="15" cy="12" r="1.7" />
    <circle cx="9" cy="18" r="1.7" />
    <circle cx="15" cy="18" r="1.7" />
  </svg>
);

export const IconChevron = () => (
  <svg {...base} width={20} height={20}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
