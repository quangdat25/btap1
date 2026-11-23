const paths = {
  home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  book: "M12 6C9 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 2Zm0 0v15",
  layers: "m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5",
  review: "M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2",
  bookmark: "M6 3h12v18l-6-4-6 4Z",
  chart: "M4 3v18h17M9 16v-5m5 5V6m5 10V9",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2-5h4l1 3 3 1 3 1v4l-3 1-1 3-1 3h-4l-1-3-3-1-3-1v-4l3-1 1-3Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM9 21h6",
  search: "M21 21l-5-5m2-6a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  chevron: "m9 5 7 7-7 7",
  down: "m6 9 6 6 6-6",
  left: "m15 5-7 7 7 7",
  close: "m6 6 12 12M6 18 18 6",
  plus: "M12 5v14M5 12h14",
  check: "m5 12 4 4L19 6",
  flame:
    "M13 2c2 6-4 7-2 11 2-1 3-3 3-5 5 4 6 8 3 12-3 3-9 2-11-2-2-5 1-9 4-11-1 4 0 5 1 5 2-3 2-6 2-10Z",
  target: "M22 12A10 10 0 1 1 12 2M18 12a6 6 0 1 1-6-6m0 6 9-9m-5 0h5v5",
  clock: "M12 7v5l3 2m7-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  play: "m9 5 11 7-11 7Z",
  sound: "M11 4 5 9H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14",
  rotate: "M20 7a9 9 0 1 0 1 8M21 2v6h-6",
  globe:
    "M2 12h20M12 2c-7 6-7 14 0 20 7-6 7-14 0-20Zm10 10a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  chat: "M21 12a9 9 0 0 1-9 9c-2 0-3-.5-4-1l-6 2 2-6c-1-1-2-2-2-4a9 9 0 0 1 19 0ZM7 9h9M7 13h6",
  briefcase: "M8 7V3h8v4M2 7h20v14H2Zm0 6c6 3 14 3 20 0m-11-1h2v5h-2Z",
  graduation: "m12 3 11 5-11 5L1 8Zm-7 8v6c4 4 10 4 14 0v-6M23 8v10",
  code: "m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18",
  leaf: "M20 3C7 1 1 10 6 17s16-2 14-14ZM4 21 16 9",
  logout: "M10 3H3v18h7m4-14 5 5-5 5m-6-5h11",
  user: "M20 21v-3a8 8 0 0 0-16 0v3M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  shield: "M12 2 3 6v6c0 5 5 8 9 10 4-2 9-5 9-10V6Zm-5 10 3 3 7-7",
  trophy:
    "M8 3h8v7a4 4 0 0 1-8 0ZM8 5H3v3c0 3 2 5 5 5m8-8h5v3c0 3-2 5-5 5m-4 1v5m-5 3h10",
  spark: "m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z",
  download: "M12 3v12m-5-5 5 5 5-5M3 15v6h18v-6",
  upload: "M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6",
  edit: "m16 3 5 5-12 12-6 1 1-6Zm-3 3 5 5",
  mail: "M3 5h18v14H3Zm0 0 9 8 9-8",
  lock: "M6 10V7a6 6 0 0 1 12 0v3M4 10h16v12H4Zm8 4v4",
  menu: "M3 6h18M3 12h18M3 18h18",
  info: "M12 11v6m0-10v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  calendar: "M3 5h18v16H3Zm4-3v6m10-6v6M3 11h18m-13 4h.1m4 0h.1m4 0h.1",
  heart: "M20 5c-3-3-7 0-8 2-1-2-5-5-8-2-5 5 1 10 8 16 7-6 13-11 8-16Z",
};
export default function Icon({ name, size = 20, className = "", ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d={paths[name] || paths.book} />
    </svg>
  );
}
