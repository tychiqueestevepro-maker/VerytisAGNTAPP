import type { ComponentProps } from "react";

type IconProps = ComponentProps<"svg">;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.45,
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

export function ActivityIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 13.2h3.1l2.1-6.4 4 10.7 2.1-4.3H20" />
      <path d="M18.6 5.8 20 4.4" />
    </svg>
  );
}

export function AgentIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7.2 8.2 12 5.4l4.8 2.8v5.6L12 16.6l-4.8-2.8Z" />
      <path d="M12 16.6v3.2" />
      <path d="M8.5 20h7" />
      <path d="M9.8 11h.1M14.1 11h.1" />
    </svg>
  );
}

export function DocumentIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 4.8h6.5L17 8.4v10.8H7Z" />
      <path d="M13.5 4.8v3.7H17" />
      <path d="M9.4 12.3h4.8" />
      <path d="M9.4 15.5h3.1" />
    </svg>
  );
}

export function IntegrationIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 7.2h3.8v3.8H8Z" />
      <path d="M14.2 13h3.8v3.8h-3.8Z" />
      <path d="M11.8 9.1h2.4" />
      <path d="M12 15h2.2" />
      <path d="M6.2 15H4.5V5.5h9.7" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 8.2v-3" />
      <path d="M12 18.8v-3" />
      <path d="M8.2 12h-3" />
      <path d="M18.8 12h-3" />
      <circle cx="12" cy="12" r="3.8" />
      <path d="m16.1 7.9 1.5-1.5M6.4 17.6l1.5-1.5" />
    </svg>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7.3 8.2c.8-2 2.5-3.2 4.8-3.2 2.7 0 4.7 1.7 4.7 4.1 0 2.7-2.4 3.6-3.8 4.8-.7.6-1 1.1-1 2.1" />
      <path d="M12 19.2h.1" />
      <path d="M4.8 16.8c-1-1.4-1.4-3-1.4-4.8 0-4.8 3.8-8.6 8.6-8.6" />
    </svg>
  );
}
