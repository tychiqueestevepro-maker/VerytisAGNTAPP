import type { ComponentProps } from "react";

type IconProps = ComponentProps<"svg">;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function MarkIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 2816 1536"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g transform="translate(0, 1536) scale(0.1, -0.1)" stroke="none">
        <path d="M17151 11207 c-180 -343 -506 -832 -715 -1072 -657 -753 -1185 -1131 -2616 -1870 -705 -364 -1039 -561 -1419 -836 -508 -366 -900 -792 -1170 -1271 -166 -293 -334 -709 -365 -903 -9 -53 22 -98 63 -93 24 3 41 33 186 323 206 412 352 640 599 935 313 375 712 686 1326 1032 290 164 443 243 1175 611 298 150 719 376 900 484 419 250 800 530 1105 814 274 254 568 600 713 837 l52 85 3 -124 c9 -345 -85 -817 -225 -1129 -148 -330 -298 -575 -514 -837 -93 -114 -326 -351 -454 -462 -470 -408 -1138 -763 -2103 -1117 -90 -33 -147 -60 -173 -82 -42 -36 -79 -98 -79 -132 0 -32 26 -75 57 -96 26 -17 48 -19 253 -18 457 2 978 70 1450 189 216 54 589 184 722 251 37 19 93 45 123 59 l55 24 -22 -42 c-90 -177 -276 -425 -448 -598 -270 -271 -583 -460 -980 -592 -197 -66 -641 -144 -920 -162 -185 -12 -577 -45 -765 -66 -1048 -113 -1670 -441 -2050 -1084 -33 -55 -70 -126 -83 -159 -21 -52 -22 -60 -9 -74 26 -25 59 -7 101 55 124 181 305 372 471 495 127 95 162 117 294 183 358 179 717 252 1416 285 229 11 363 18 495 25 47 3 137 7 200 10 292 15 638 72 885 147 757 229 1343 712 1733 1428 136 249 323 756 349 945 l6 48 -64 -43 c-35 -24 -91 -64 -124 -90 -178 -138 -464 -315 -716 -443 -430 -219 -930 -380 -1409 -453 -19 -3 24 19 95 49 759 317 1372 707 1792 1140 485 500 795 1071 913 1682 107 549 107 1055 0 1590 -16 77 -31 159 -35 183 -4 23 -10 42 -13 42 -4 0 -31 -46 -61 -103z" />
      </g>
    </svg>
  );
}

export function DashboardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 13.5V6.8c0-1.2.7-1.9 1.9-1.9h4.1" />
      <path d="M19.5 10.5v6.7c0 1.2-.7 1.9-1.9 1.9h-4.1" />
      <path d="M5 18.7h5.2" />
      <path d="M13.8 5.3H19" />
      <path d="M8.2 9.8h7.6" />
    </svg>
  );
}


export function AgentIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2L4.5 9L12 16L19.5 9L12 2Z" />
      <path d="M12 16V22" />
      <path d="M8 22H16" />
      <circle cx="12" cy="9" r="2" />
    </svg>
  );
}

export function ReportIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 16V10" />
      <path d="M11 16V6" />
      <path d="M15 16V12" />
      <path d="M19 16V8" />
    </svg>
  );
}

export function DocumentIcon(props: IconProps) {

  return (
    <svg {...base} {...props}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

export function IntegrationIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M15 7h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3" />
      <path d="M9 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3" />
      <path d="M7 12h10" />
      <path d="m13 8 4 4-4 4" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export function LinkedinIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
