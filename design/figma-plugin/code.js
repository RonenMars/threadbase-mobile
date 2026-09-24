// Finishes the Threadbase Mobile design system started over the Figma MCP.
// Every step skips itself if its output already exists, so re-running is safe.

const THEMES = ['dark', 'light', 'catppuccin', 'catppuccinLatte', 'nord', 'oneDark', 'rosePineDawn', 'tokyoNightLight'];
const SERVER_PALETTE = ['#63b3ff', '#4ade80', '#22d3ee', '#a78bfa', '#fb7185', '#fbbf24', '#a3a3a3', '#f08a24'];
const EXTRA_ICONS = {
  SlidersHorizontal: 'M40 88h33a32 32 0 0 0 62 0h81a8 8 0 0 0 0-16h-81a32 32 0 0 0-62 0H40a8 8 0 0 0 0 16m64-24a16 16 0 1 1-16 16 16 16 0 0 1 16-16m112 104h-17a32 32 0 0 0-62 0H40a8 8 0 0 0 0 16h97a32 32 0 0 0 62 0h17a8 8 0 0 0 0-16m-48 24a16 16 0 1 1 16-16 16 16 0 0 1-16 16',
  Gear: 'M128 80a48 48 0 1 0 48 48 48.05 48.05 0 0 0-48-48m0 80a32 32 0 1 1 32-32 32 32 0 0 1-32 32m88-29.84q.06-2.16 0-4.32l14.92-18.64a8 8 0 0 0 1.48-7.06 107.2 107.2 0 0 0-10.88-26.25 8 8 0 0 0-6-3.930l-23.72-2.64q-1.48-1.56-3-3L186 40.54a8 8 0 0 0-3.94-6 107.7 107.7 0 0 0-26.25-10.87 8 8 0 0 0-7.06 1.49L130.16 40h-4.32L107.2 25.11a8 8 0 0 0-7.06-1.48 107.6 107.6 0 0 0-26.25 10.88 8 8 0 0 0-3.93 6l-2.64 23.76q-1.56 1.49-3 3L40.54 70a8 8 0 0 0-6 3.94 107.7 107.7 0 0 0-10.87 26.25 8 8 0 0 0 1.49 7.06L40 125.84v4.32L25.11 148.8a8 8 0 0 0-1.48 7.06 107.2 107.2 0 0 0 10.88 26.25 8 8 0 0 0 6 3.93l23.72 2.64q1.49 1.56 3 3L70 215.46a8 8 0 0 0 3.94 6 107.7 107.7 0 0 0 26.25 10.87 8 8 0 0 0 7.060-1.49L125.84 216q2.16.06 4.32 0l18.64 14.92a8 8 0 0 0 7.06 1.48 107.2 107.2 0 0 0 26.25-10.88 8 8 0 0 0 3.93-6l2.64-23.72q1.56-1.48 3-3l23.78-2.8a8 8 0 0 0 6-3.94 107.7 107.7 0 0 0 10.87-26.25 8 8 0 0 0-1.49-7.06Zm-16.1-6.5a74 74 0 0 1 0 8.68 8 8 0 0 0 1.74 5.48l14.19 17.73a91.6 91.6 0 0 1-6.23 15l-22.6 2.56a8 8 0 0 0-5.1 2.64 74 74 0 0 1-6.14 6.14 8 8 0 0 0-2.64 5.1l-2.51 22.58a91.3 91.3 0 0 1-15 6.23l-17.74-14.19a8 8 0 0 0-5-1.75h-.48a74 74 0 0 1-8.68 0 8 8 0 0 0-5.48 1.74l-17.78 14.2a91.6 91.6 0 0 1-15-6.23L82.89 187a8 8 0 0 0-2.64-5.1 74 74 0 0 1-6.14-6.14 8 8 0 0 0-5.1-2.64l-22.58-2.52a91.3 91.3 0 0 1-6.23-15l14.19-17.74a8 8 0 0 0 1.74-5.48 74 74 0 0 1 0-8.68 8 8 0 0 0-1.74-5.48L40.2 100.45a91.6 91.6 0 0 1 6.23-15L69 82.89a8 8 0 0 0 5.1-2.64 74 74 0 0 1 6.14-6.14A8 8 0 0 0 82.89 69l2.51-22.57a91.3 91.3 0 0 1 15-6.23l17.74 14.19a8 8 0 0 0 5.48 1.74 74 74 0 0 1 8.68 0 8 8 0 0 0 5.48-1.74l17.77-14.19a91.6 91.6 0 0 1 15 6.23L173.11 69a8 8 0 0 0 2.64 5.1 74 74 0 0 1 6.14 6.14 8 8 0 0 0 5.1 2.64l22.58 2.51a91.3 91.3 0 0 1 6.23 15l-14.19 17.74a8 8 0 0 0-1.74 5.53Z',
};
EXTRA_ICONS.Terminal = 'm117.31 134-72 64a8 8 0 1 1-10.63-12L100 128 34.69 70a8 8 0 1 1 10.63-12l72 64a8 8 0 0 1 0 12ZM216 184h-96a8 8 0 0 0 0 16h96a8 8 0 0 0 0-16';
EXTRA_ICONS.CellSignalSlash = 'M88 152v48a8 8 0 0 1-16 0v-48a8 8 0 0 1 16 0m-48 32a8 8 0 0 0-8 8v8a8 8 0 0 0 16 0v-8a8 8 0 0 0-8-8m173.92 26.62-160-176a8 8 0 1 0-11.84 10.76L112 122.29V200a8 8 0 0 0 16 0v-60.11l24 26.4V200a8 8 0 0 0 16 0v-16.11l34.08 37.49a8 8 0 1 0 11.84-10.76m-53.92-87a8 8 0 0 0 8-8V72a8 8 0 0 0-16 0v43.63a8 8 0 0 0 8 8Zm40 44a8 8 0 0 0 8-8V32a8 8 0 0 0-16 0v127.63a8 8 0 0 0 8 8Z';
EXTRA_ICONS["FileCode"] = "M181.66 146.34a8 8 0 0 1 0 11.32l-24 24a8 8 0 0 1-11.32-11.32L164.69 152l-18.35-18.34a8 8 0 0 1 11.32-11.32Zm-72-24a8 8 0 0 0-11.32 0l-24 24a8 8 0 0 0 0 11.32l24 24a8 8 0 0 0 11.32-11.32L91.31 152l18.35-18.34a8 8 0 0 0 0-11.32M216 88v128a16 16 0 0 1-16 16H56a16 16 0 0 1-16-16V40a16 16 0 0 1 16-16h96a8 8 0 0 1 5.66 2.34l56 56A8 8 0 0 1 216 88m-56-8h28.69L160 51.31Zm40 136V96h-48a8 8 0 0 1-8-8V40H56v176z";
EXTRA_ICONS["Pause-fill"] = "M216 48v160a16 16 0 0 1-16 16h-40a16 16 0 0 1-16-16V48a16 16 0 0 1 16-16h40a16 16 0 0 1 16 16M96 32H56a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h40a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16";
EXTRA_ICONS["Play-fill"] = "M240 128a15.74 15.74 0 0 1-7.6 13.51L88.32 229.65a16 16 0 0 1-16.2.3A15.86 15.86 0 0 1 64 216.13V39.87a15.86 15.86 0 0 1 8.12-13.82 16 16 0 0 1 16.2.3l144.08 88.14A15.74 15.74 0 0 1 240 128";
EXTRA_ICONS["Paperclip"] = "M209.66 122.34a8 8 0 0 1 0 11.32l-82.05 82a56 56 0 0 1-79.2-79.21l99.26-100.72a40 40 0 1 1 56.61 56.55L105 193a24 24 0 1 1-34-34l83.3-84.62a8 8 0 1 1 11.4 11.22l-83.31 84.71a8 8 0 1 0 11.27 11.36L192.93 81A24 24 0 1 0 159 47L59.76 147.68a40 40 0 1 0 56.53 56.62l82.06-82a8 8 0 0 1 11.31.04";
EXTRA_ICONS["PaperPlaneRight"] = "m231.87 114-168-95.89a16 16 0 0 0-22.95 19.23L71.55 128l-30.63 90.67A16 16 0 0 0 56 240a16.15 16.15 0 0 0 7.93-2.1l167.92-96.05a16 16 0 0 0 .05-27.89ZM56 224a.6.6 0 0 0 0-.12L85.74 136H144a8 8 0 0 0 0-16H85.74L56.06 32.16A.5.5 0 0 0 56 32l168 95.83Z";
EXTRA_ICONS["Microphone"] = "M128 176a48.05 48.05 0 0 0 48-48V64a48 48 0 0 0-96 0v64a48.05 48.05 0 0 0 48 48M96 64a32 32 0 0 1 64 0v64a32 32 0 0 1-64 0Zm40 143.6V240a8 8 0 0 1-16 0v-32.4A80.11 80.11 0 0 1 48 128a8 8 0 0 1 16 0 64 64 0 0 0 128 0 8 8 0 0 1 16 0 80.11 80.11 0 0 1-72 79.6";
EXTRA_ICONS["MicrophoneSlash"] = "m213.92 218.62-160-176a8 8 0 0 0-11.84 10.76L80 95.09V128a48 48 0 0 0 69.11 43.12l11.1 12.2A63.4 63.4 0 0 1 128 192a64.07 64.07 0 0 1-64-64 8 8 0 0 0-16 0 80.11 80.11 0 0 0 72 79.6V240a8 8 0 0 0 16 0v-32.41a78.8 78.8 0 0 0 35.16-12.22l30.92 34a8 8 0 1 0 11.84-10.76ZM128 160a32 32 0 0 1-32-32v-15.31l41.66 45.82A32 32 0 0 1 128 160m57.52-3.91A63.3 63.3 0 0 0 192 128a8 8 0 0 1 16 0 79.16 79.16 0 0 1-8.11 35.12 8 8 0 0 1-7.19 4.49 7.9 7.9 0 0 1-3.51-.82 8 8 0 0 1-3.67-10.7M84 44.87A48 48 0 0 1 176 64v64a49 49 0 0 1-.26 5 8 8 0 0 1-8 7.17 8 8 0 0 1-.84 0 8 8 0 0 1-7.12-8.79c.11-1.1.17-2.24.17-3.36V64a32 32 0 0 0-61.31-12.75A8 8 0 1 1 84 44.87";
EXTRA_ICONS["ArrowsOut"] = "M216 48v48a8 8 0 0 1-16 0V67.31l-42.34 42.35a8 8 0 0 1-11.32-11.32L188.69 56H160a8 8 0 0 1 0-16h48a8 8 0 0 1 8 8M98.34 146.34 56 188.69V160a8 8 0 0 0-16 0v48a8 8 0 0 0 8 8h48a8 8 0 0 0 0-16H67.31l42.35-42.34a8 8 0 0 0-11.32-11.32M208 152a8 8 0 0 0-8 8v28.69l-42.34-42.35a8 8 0 0 0-11.32 11.32L188.69 200H160a8 8 0 0 0 0 16h48a8 8 0 0 0 8-8v-48a8 8 0 0 0-8-8M67.31 56H96a8 8 0 0 0 0-16H48a8 8 0 0 0-8 8v48a8 8 0 0 0 16 0V67.31l42.34 42.35a8 8 0 0 0 11.32-11.32Z";
EXTRA_ICONS["Image"] = "M216 40H40a16 16 0 0 0-16 16v144a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16m0 16v102.75l-26.07-26.06a16 16 0 0 0-22.63 0l-20 20-44-44a16 16 0 0 0-22.62 0L40 149.37V56ZM40 172l52-52 80 80H40Zm176 28h-21.37l-36-36 20-20L216 181.38zm-72-100a12 12 0 1 1 12 12 12 12 0 0 1-12-12";
EXTRA_ICONS["Sparkle"] = "M197.58 129.06 146 110l-19-51.62a15.92 15.92 0 0 0-29.88 0L78 110l-51.62 19a15.92 15.92 0 0 0 0 29.88L78 178l19 51.62a15.92 15.92 0 0 0 29.88 0L146 178l51.62-19a15.92 15.92 0 0 0 0-29.88ZM137 164.22a8 8 0 0 0-4.74 4.74L112 223.85 91.78 169a8 8 0 0 0-4.78-4.78L32.15 144 87 123.78a8 8 0 0 0 4.78-4.78L112 64.15 132.22 119a8 8 0 0 0 4.74 4.74L191.85 144ZM144 40a8 8 0 0 1 8-8h16V16a8 8 0 0 1 16 0v16h16a8 8 0 0 1 0 16h-16v16a8 8 0 0 1-16 0V48h-16a8 8 0 0 1-8-8m104 48a8 8 0 0 1-8 8h-8v8a8 8 0 0 1-16 0v-8h-8a8 8 0 0 1 0-16h8v-8a8 8 0 0 1 16 0v8h8a8 8 0 0 1 8 8";
EXTRA_ICONS["Plug"] = "M237.66 66.34a8 8 0 0 0-11.32 0L192 100.69 155.31 64l34.35-34.34a8 8 0 1 0-11.32-11.32L144 52.69l-26.34-26.35a8 8 0 0 0-11.32 11.32l6.35 6.34-53 53a40 40 0 0 0 0 56.57l15.71 15.71-49.06 49.06a8 8 0 0 0 11.32 11.32l49.09-49.09 15.71 15.71a40 40 0 0 0 56.57 0l53-53 6.34 6.35a8 8 0 0 0 11.32-11.32L203.31 112l34.35-34.34a8 8 0 0 0 0-11.32M147.72 185a24 24 0 0 1-33.95 0L71 142.23a24 24 0 0 1 0-33.95l53-53L200.69 132Z";
EXTRA_ICONS["Bell"] = "M221.8 175.94c-5.55-9.56-13.8-36.61-13.8-71.94a80 80 0 1 0-160 0c0 35.34-8.26 62.38-13.81 71.94A16 16 0 0 0 48 200h40.81a40 40 0 0 0 78.38 0H208a16 16 0 0 0 13.8-24.06M128 216a24 24 0 0 1-22.62-16h45.24A24 24 0 0 1 128 216m-80-32c7.7-13.24 16-43.92 16-80a64 64 0 1 1 128 0c0 36.05 8.28 66.73 16 80Z";
EXTRA_ICONS["GlobeSimple"] = "M128 24a104 104 0 1 0 104 104A104.12 104.12 0 0 0 128 24m87.62 96h-39.83c-1.79-36.51-15.85-62.33-27.38-77.6a88.19 88.19 0 0 1 67.22 77.6ZM96.23 136h63.54c-2.31 41.61-22.23 67.11-31.77 77-9.55-9.9-29.46-35.4-31.77-77m0-16c2.31-41.61 22.23-67.11 31.77-77 9.55 9.93 29.46 35.43 31.77 77Zm11.36-77.6C96.06 57.67 82 83.49 80.21 120H40.37a88.19 88.19 0 0 1 67.22-77.6M40.37 136h39.84c1.82 36.51 15.85 62.33 27.38 77.6A88.19 88.19 0 0 1 40.37 136m108 77.6c11.53-15.27 25.56-41.09 27.38-77.6h39.84a88.19 88.19 0 0 1-67.18 77.6Z";
EXTRA_ICONS["Copy"] = "M216 32H88a8 8 0 0 0-8 8v40H40a8 8 0 0 0-8 8v128a8 8 0 0 0 8 8h128a8 8 0 0 0 8-8v-40h40a8 8 0 0 0 8-8V40a8 8 0 0 0-8-8m-56 176H48V96h112Zm48-48h-32V88a8 8 0 0 0-8-8H96V48h112Z";
EXTRA_ICONS["Check"] = "m229.66 77.66-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32";
EXTRA_ICONS["CaretLeft"] = "M165.66 202.34a8 8 0 0 1-11.32 11.32l-80-80a8 8 0 0 1 0-11.32l80-80a8 8 0 0 1 11.32 11.32L91.31 128Z";
EXTRA_ICONS["DotsThreeVertical"] = "M140 128a12 12 0 1 1-12-12 12 12 0 0 1 12 12m-12-56a12 12 0 1 0-12-12 12 12 0 0 0 12 12m0 112a12 12 0 1 0 12 12 12 12 0 0 0-12-12";
EXTRA_ICONS["Folder"] = "M216 72h-84.69L104 44.69A15.86 15.86 0 0 0 92.69 40H40a16 16 0 0 0-16 16v144.62A15.4 15.4 0 0 0 39.38 216h177.51A15.13 15.13 0 0 0 232 200.89V88a16 16 0 0 0-16-16M40 56h52.69l16 16H40Zm176 144H40V88h176Z";
EXTRA_ICONS["Lightning"] = "M215.79 118.17a8 8 0 0 0-5-5.66L153.18 90.9l14.66-73.33a8 8 0 0 0-13.69-7l-112 120a8 8 0 0 0 3 13l57.63 21.61-14.62 73.25a8 8 0 0 0 13.69 7l112-120a8 8 0 0 0 1.94-7.26M109.37 214l10.47-52.38a8 8 0 0 0-5-9.06L62 132.71l84.62-90.66-10.46 52.38a8 8 0 0 0 5 9.06l52.8 19.8Z";
EXTRA_ICONS["Star"] = "M239.18 97.26A16.38 16.38 0 0 0 224.92 86l-59-4.76-22.78-55.09a16.36 16.36 0 0 0-30.27 0L90.11 81.23 31.08 86a16.46 16.46 0 0 0-9.37 28.86l45 38.83L53 211.75a16.38 16.38 0 0 0 24.5 17.82l50.5-31.08 50.53 31.08A16.4 16.4 0 0 0 203 211.75l-13.76-58.07 45-38.83a16.43 16.43 0 0 0 4.94-17.59m-15.34 5.47-48.7 42a8 8 0 0 0-2.56 7.91l14.88 62.8a.37.37 0 0 1-.17.48c-.18.14-.23.11-.38 0l-54.72-33.65a8 8 0 0 0-8.38 0l-54.72 33.67c-.15.09-.19.12-.38 0a.37.37 0 0 1-.17-.48l14.88-62.8a8 8 0 0 0-2.56-7.91l-48.7-42c-.12-.1-.23-.19-.13-.5s.18-.27.33-.29l63.92-5.16a8 8 0 0 0 6.72-4.94l24.62-59.61c.08-.17.11-.25.35-.25s.27.08.35.25L153 91.86a8 8 0 0 0 6.75 4.92l63.92 5.16c.15 0 .24 0 .33.29s0 .4-.16.5";
EXTRA_ICONS["Star-fill"] = "m234.29 114.85-45 38.83L203 211.75a16.4 16.4 0 0 1-24.5 17.82L128 198.49l-50.53 31.08A16.4 16.4 0 0 1 53 211.75l13.76-58.07-45-38.83A16.46 16.46 0 0 1 31.08 86l59-4.76 22.76-55.08a16.36 16.36 0 0 1 30.27 0l22.75 55.08 59 4.76a16.46 16.46 0 0 1 9.37 28.86Z";
EXTRA_ICONS["ArrowRight"] = "m221.66 133.66-72 72a8 8 0 0 1-11.32-11.32L196.69 136H40a8 8 0 0 1 0-16h156.69l-58.35-58.34a8 8 0 0 1 11.32-11.32l72 72a8 8 0 0 1 0 11.32";
EXTRA_ICONS["FolderOpen"] = "M245 110.64a16 16 0 0 0-13-6.64h-16V88a16 16 0 0 0-16-16h-69.33l-27.73-20.8a16.14 16.14 0 0 0-9.6-3.2H40a16 16 0 0 0-16 16v144a8 8 0 0 0 8 8h179.1a8 8 0 0 0 7.59-5.47l28.49-85.47a16.05 16.05 0 0 0-2.18-14.42M93.34 64l29.86 22.4A8 8 0 0 0 128 88h72v16H69.77a16 16 0 0 0-15.18 10.94L40 158.7V64Zm112 136H43.1l26.67-80H232Z";
EXTRA_ICONS["ChatsCircle-fill"] = "M232.07 186.76a80 80 0 0 0-62.5-114.17 80 80 0 1 0-145.64 66.17l-7.27 24.71a16 16 0 0 0 19.87 19.87l24.71-7.27a80.4 80.4 0 0 0 25.18 7.35 80 80 0 0 0 108.34 40.65l24.71 7.27a16 16 0 0 0 19.87-19.86Zm-16.25 1.47L224 216l-27.76-8.17a8 8 0 0 0-6 .63 64.05 64.05 0 0 1-85.87-24.88 79.93 79.93 0 0 0 70.33-93.87 64 64 0 0 1 41.75 92.48 8 8 0 0 0-.63 6.04";
EXTRA_ICONS["ShareNetwork"] = "M176 160a39.9 39.9 0 0 0-28.62 12.09l-46.1-29.63a39.8 39.8 0 0 0 0-28.92l46.1-29.63a40 40 0 1 0-8.66-13.45l-46.1 29.63a40 40 0 1 0 0 55.82l46.1 29.63A40 40 0 1 0 176 160m0-128a24 24 0 1 1-24 24 24 24 0 0 1 24-24M64 152a24 24 0 1 1 24-24 24 24 0 0 1-24 24m112 72a24 24 0 1 1 24-24 24 24 0 0 1-24 24";
EXTRA_ICONS["X-bold"] = "M208.49 191.51a12 12 0 0 1-17 17L128 145l-63.51 63.49a12 12 0 0 1-17-17L111 128 47.51 64.49a12 12 0 0 1 17-17L128 111l63.51-63.52a12 12 0 0 1 17 17L145 128Z";
EXTRA_ICONS["CheckCircle-fill"] = "M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24m45.66 85.66-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 11.32";
EXTRA_ICONS["Circle"] = "M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24m0 192a88 88 0 1 1 88-88 88.1 88.1 0 0 1-88 88";
EXTRA_ICONS["LockKeyOpen-fill"] = "M208 80H96V56a32 32 0 0 1 32-32c15.37 0 29.2 11 32.16 25.59a8 8 0 0 0 15.68-3.18C171.32 24.15 151.2 8 128 8a48.05 48.05 0 0 0-48 48v24H48a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V96a16 16 0 0 0-16-16m-72 78.63V184a8 8 0 0 1-16 0v-25.37a24 24 0 1 1 16 0";
EXTRA_ICONS["PlugsConnected-light"] = "M236.24 19.76a6 6 0 0 0-8.48 0l-53.82 53.81-6.79-6.78a30 30 0 0 0-42.42 0L100 91.51l-7.76-7.75a6 6 0 0 0-8.48 8.48l7.75 7.76-24.72 24.73a30 30 0 0 0 0 42.42l6.78 6.79-53.81 53.82a6 6 0 1 0 8.48 8.48l53.82-53.81 6.79 6.78a30 30 0 0 0 42.42 0L156 164.49l7.76 7.75a6 6 0 0 0 8.48-8.48l-7.75-7.76 24.72-24.73a30 30 0 0 0 0-42.42l-6.78-6.79 53.81-53.82a6 6 0 0 0 0-8.48m-113.45 161a18 18 0 0 1-25.46 0l-22.06-22.09a18 18 0 0 1 0-25.46L100 108.49 147.51 156Zm57.94-57.94L156 147.51 108.49 100l24.72-24.73a18 18 0 0 1 25.46 0l22.06 22.06a18 18 0 0 1 0 25.46Zm-90.3-88.59a6 6 0 0 1 11.14-4.46l8 20a6 6 0 1 1-11.14 4.46Zm-64 59.54a6 6 0 0 1 7.8-3.34l20 8a6 6 0 1 1-4.46 11.14l-20-8a6 6 0 0 1-3.34-7.8m203.14 68.46a6 6 0 0 1-7.8 3.34l-20-8a6 6 0 0 1 4.46-11.14l20 8a6 6 0 0 1 3.34 7.8m-64 59.54a6 6 0 1 1-11.14 4.46l-8-20a6 6 0 0 1 11.14-4.46Z";
EXTRA_ICONS["ClipboardText"] = "M168 152a8 8 0 0 1-8 8H96a8 8 0 0 1 0-16h64a8 8 0 0 1 8 8m-8-40H96a8 8 0 0 0 0 16h64a8 8 0 0 0 0-16m56-64v168a16 16 0 0 1-16 16H56a16 16 0 0 1-16-16V48a16 16 0 0 1 16-16h36.26a47.92 47.92 0 0 1 71.48 0H200a16 16 0 0 1 16 16M96 64h64a32 32 0 0 0-64 0m104-16h-26.75A47.9 47.9 0 0 1 176 64v8a8 8 0 0 1-8 8H88a8 8 0 0 1-8-8v-8a47.9 47.9 0 0 1 2.75-16H56v168h144Z";
EXTRA_ICONS["Eye"] = "M247.31 124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57 61.26 162.88 48 128 48S61.43 61.26 36.34 86.35C17.51 105.18 9 124 8.69 124.76a8 8 0 0 0 0 6.5c.35.79 8.82 19.57 27.65 38.4C61.43 194.74 93.12 208 128 208s66.57-13.26 91.66-38.34c18.83-18.83 27.3-37.61 27.65-38.4a8 8 0 0 0 0-6.5M128 192c-30.78 0-57.67-11.19-79.93-33.25A133.5 133.5 0 0 1 25 128a133.3 133.3 0 0 1 23.07-30.75C70.33 75.19 97.22 64 128 64s57.67 11.19 79.93 33.25A133.5 133.5 0 0 1 231.05 128c-7.21 13.46-38.62 64-103.05 64m0-112a48 48 0 1 0 48 48 48.05 48.05 0 0 0-48-48m0 80a32 32 0 1 1 32-32 32 32 0 0 1-32 32";
EXTRA_ICONS["XCircle-fill"] = "M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24m37.66 130.34a8 8 0 0 1-11.32 11.32L128 139.31l-26.34 26.35a8 8 0 0 1-11.32-11.32L116.69 128l-26.35-26.34a8 8 0 0 1 11.32-11.32L128 116.69l26.34-26.35a8 8 0 0 1 11.32 11.32L139.31 128Z";
EXTRA_ICONS["Cloud"] = "M160 40a88.09 88.09 0 0 0-78.71 48.67A64 64 0 1 0 72 216h88a88 88 0 0 0 0-176m0 160H72a48 48 0 0 1 0-96c1.1 0 2.2 0 3.29.11A88 88 0 0 0 72 128a8 8 0 0 0 16 0 72 72 0 1 1 72 72";
EXTRA_ICONS["LockSimple"] = "M208 80h-32V56a48 48 0 0 0-96 0v24H48a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V96a16 16 0 0 0-16-16M96 56a32 32 0 0 1 64 0v24H96Zm112 152H48V96h160z";
EXTRA_ICONS["ArrowRight-bold"] = "m224.49 136.49-72 72a12 12 0 0 1-17-17L187 140H40a12 12 0 0 1 0-24h147l-51.49-51.52a12 12 0 0 1 17-17l72 72a12 12 0 0 1-.02 17.01";
EXTRA_ICONS["CaretDown-bold"] = "m216.49 104.49-80 80a12 12 0 0 1-17 0l-80-80a12 12 0 0 1 17-17L128 159l71.51-71.52a12 12 0 0 1 17 17Z";
EXTRA_ICONS["Check-bold"] = "m232.49 80.49-128 128a12 12 0 0 1-17 0l-56-56a12 12 0 1 1 17-17L96 183 215.51 63.51a12 12 0 0 1 17 17Z";
EXTRA_ICONS["DotsThreeVertical-bold"] = "M112 60a16 16 0 1 1 16 16 16 16 0 0 1-16-16m16 52a16 16 0 1 0 16 16 16 16 0 0 0-16-16m0 68a16 16 0 1 0 16 16 16 16 0 0 0-16-16";
EXTRA_ICONS["QrCode"] = "M104 40H56a16 16 0 0 0-16 16v48a16 16 0 0 0 16 16h48a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16m0 64H56V56h48zm0 32H56a16 16 0 0 0-16 16v48a16 16 0 0 0 16 16h48a16 16 0 0 0 16-16v-48a16 16 0 0 0-16-16m0 64H56v-48h48zm96-160h-48a16 16 0 0 0-16 16v48a16 16 0 0 0 16 16h48a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16m0 64h-48V56h48zm-64 72v-32a8 8 0 0 1 16 0v32a8 8 0 0 1-16 0m80-16a8 8 0 0 1-8 8h-24v40a8 8 0 0 1-8 8h-32a8 8 0 0 1 0-16h24v-56a8 8 0 0 1 16 0v8h24a8 8 0 0 1 8 8m0 32v16a8 8 0 0 1-16 0v-16a8 8 0 0 1 16 0";
EXTRA_ICONS["ShieldWarning-fill"] = "M208 40H48a16 16 0 0 0-16 16v56c0 52.72 25.52 84.67 46.93 102.19 23.06 18.86 46 25.27 47 25.53a8 8 0 0 0 4.2 0c1-.26 23.91-6.67 47-25.53C198.48 196.67 224 164.72 224 112V56a16 16 0 0 0-16-16m-88 56a8 8 0 0 1 16 0v40a8 8 0 0 1-16 0Zm8 88a12 12 0 1 1 12-12 12 12 0 0 1-12 12";
EXTRA_ICONS["ShieldCheck-fill"] = "M208 40H48a16 16 0 0 0-16 16v56c0 52.72 25.52 84.67 46.93 102.19 23.06 18.86 46 25.26 47 25.53a8 8 0 0 0 4.2 0c1-.27 23.91-6.67 47-25.53C198.48 196.67 224 164.72 224 112V56a16 16 0 0 0-16-16m-34.32 69.66-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 11.32Z";
EXTRA_ICONS["ShieldSlash-fill"] = "M224 56v56c0 25.24-5.85 45.72-14.3 62.14a4 4 0 0 1-6.53.87L86.52 46.69a4 4 0 0 1 3-6.69H208a16 16 0 0 1 16 16M53.92 34.62A8 8 0 0 0 40.26 42 16 16 0 0 0 32 56v56c0 52.72 25.52 84.67 46.93 102.19 23.06 18.86 46 25.27 47 25.53a8 8 0 0 0 4.2 0c1-.26 23.91-6.67 47-25.53a132 132 0 0 0 10.05-9.19l14.9 16.38a8 8 0 1 0 11.84-10.76Z";
EXTRA_ICONS["ClockCounterClockwise"] = "M136 80v43.47l36.12 21.67a8 8 0 0 1-8.24 13.72l-40-24A8 8 0 0 1 120 128V80a8 8 0 0 1 16 0m-8-48a95.44 95.44 0 0 0-67.92 28.15C52.81 67.51 46.35 74.59 40 82V64a8 8 0 0 0-16 0v40a8 8 0 0 0 8 8h40a8 8 0 0 0 0-16H49c7.15-8.42 14.27-16.35 22.39-24.57a80 80 0 1 1 1.66 114.75 8 8 0 1 0-11 11.64A96 96 0 1 0 128 32";
EXTRA_ICONS["RadioButton-fill"] = "M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24m0 192a88 88 0 1 1 88-88 88.1 88.1 0 0 1-88 88m56-88a56 56 0 1 1-56-56 56.06 56.06 0 0 1 56 56";
EXTRA_ICONS["CheckSquare-fill"] = "M208 32H48a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16m-34.34 77.66-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 11.32";
EXTRA_ICONS["Square"] = "M208 32H48a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16m0 176H48V48h160z";
EXTRA_ICONS["CopySimple"] = "M184 64H40a8 8 0 0 0-8 8v144a8 8 0 0 0 8 8h144a8 8 0 0 0 8-8V72a8 8 0 0 0-8-8m-8 144H48V80h128Zm48-168v144a8 8 0 0 1-16 0V48H72a8 8 0 0 1 0-16h144a8 8 0 0 1 8 8";
EXTRA_ICONS["PaperPlaneTilt"] = "M227.32 28.68a16 16 0 0 0-15.66-4.08h-.15L19.57 82.84a16 16 0 0 0-2.49 29.8L102 154l41.3 84.87a15.86 15.86 0 0 0 14.44 9.13q.69 0 1.38-.06a15.88 15.88 0 0 0 14-11.51l58.2-191.94v-.15a16 16 0 0 0-4-15.66m-69.49 203.17-.05.14v-.07l-40.06-82.3 48-48a8 8 0 0 0-11.31-11.31l-48 48-82.33-40.06h-.07.14L216 40Z";
EXTRA_ICONS["Trash"] = "M216 48h-40v-8a24 24 0 0 0-24-24h-48a24 24 0 0 0-24 24v8H40a8 8 0 0 0 0 16h8v144a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16V64h8a8 8 0 0 0 0-16M96 40a8 8 0 0 1 8-8h48a8 8 0 0 1 8 8v8H96Zm96 168H64V64h128Zm-80-104v64a8 8 0 0 1-16 0v-64a8 8 0 0 1 16 0m48 0v64a8 8 0 0 1-16 0v-64a8 8 0 0 1 16 0";
EXTRA_ICONS["Stack"] = "M230.91 172a8 8 0 0 1-2.91 10.91l-96 56a8 8 0 0 1-8.06 0l-96-56A8 8 0 0 1 36 169.09l92 53.65 92-53.65a8 8 0 0 1 10.91 2.91M220 121.09l-92 53.65-92-53.65a8 8 0 0 0-8 13.82l96 56a8 8 0 0 0 8.06 0l96-56a8 8 0 1 0-8.06-13.82M24 80a8 8 0 0 1 4-6.91l96-56a8 8 0 0 1 8.06 0l96 56a8 8 0 0 1 0 13.82l-96 56a8 8 0 0 1-8.06 0l-96-56A8 8 0 0 1 24 80m23.88 0L128 126.74 208.12 80 128 33.26Z";
EXTRA_ICONS["CheckCircle"] = "M173.66 98.34a8 8 0 0 1 0 11.32l-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 0M232 128A104 104 0 1 1 128 24a104.11 104.11 0 0 1 104 104m-16 0a88 88 0 1 0-88 88 88.1 88.1 0 0 0 88-88";
EXTRA_ICONS["Pulse"] = "M240 128a8 8 0 0 1-8 8h-27.06l-37.78 75.58A8 8 0 0 1 160 216h-.4a8 8 0 0 1-7.08-5.14L95.35 60.76l-32.07 70.55A8 8 0 0 1 56 136H24a8 8 0 0 1 0-16h26.85l37.87-83.31a8 8 0 0 1 14.76.46l57.51 151 31.85-63.71A8 8 0 0 1 200 120h32a8 8 0 0 1 8 8";
EXTRA_ICONS["CaretUp-bold"] = "M216.49 168.49a12 12 0 0 1-17 0L128 97l-71.51 71.49a12 12 0 0 1-17-17l80-80a12 12 0 0 1 17 0l80 80a12 12 0 0 1 0 17";
EXTRA_ICONS["ArrowsIn"] = "M144 104V64a8 8 0 0 1 16 0v20.69l42.34-42.35a8 8 0 0 1 11.32 11.32L171.31 96H192a8 8 0 0 1 0 16h-40a8 8 0 0 1-8-8m-40 40H64a8 8 0 0 0 0 16h20.69l-42.35 42.34a8 8 0 0 0 11.32 11.32L96 171.31V192a8 8 0 0 0 16 0v-40a8 8 0 0 0-8-8m67.31 16H192a8 8 0 0 0 0-16h-40a8 8 0 0 0-8 8v40a8 8 0 0 0 16 0v-20.69l42.34 42.35a8 8 0 0 0 11.32-11.32ZM104 56a8 8 0 0 0-8 8v20.69L53.66 42.34a8 8 0 0 0-11.32 11.32L84.69 96H64a8 8 0 0 0 0 16h40a8 8 0 0 0 8-8V64a8 8 0 0 0-8-8";
EXTRA_ICONS["ArrowLeft-bold"] = "M228 128a12 12 0 0 1-12 12H69l51.52 51.51a12 12 0 0 1-17 17l-72-72a12 12 0 0 1 0-17l72-72a12 12 0 0 1 17 17L69 116h147a12 12 0 0 1 12 12";
EXTRA_ICONS["Warning"] = "M236.8 188.09 149.35 36.22a24.76 24.76 0 0 0-42.7 0L19.2 188.09a23.51 23.51 0 0 0 0 23.72A24.35 24.35 0 0 0 40.55 224h174.9a24.35 24.35 0 0 0 21.33-12.19 23.51 23.51 0 0 0 .02-23.72m-13.87 15.71a8.5 8.5 0 0 1-7.48 4.2H40.55a8.5 8.5 0 0 1-7.48-4.2 7.59 7.59 0 0 1 0-7.72l87.45-151.87a8.75 8.75 0 0 1 15 0l87.45 151.87a7.59 7.59 0 0 1-.04 7.72M120 144v-40a8 8 0 0 1 16 0v40a8 8 0 0 1-16 0m20 36a12 12 0 1 1-12-12 12 12 0 0 1 12 12";
EXTRA_ICONS["WarningCircle"] = "M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24m0 192a88 88 0 1 1 88-88 88.1 88.1 0 0 1-88 88m-8-80V80a8 8 0 0 1 16 0v56a8 8 0 0 1-16 0m20 36a12 12 0 1 1-12-12 12 12 0 0 1 12 12";
EXTRA_ICONS["Info"] = "M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24m0 192a88 88 0 1 1 88-88 88.1 88.1 0 0 1-88 88m16-40a8 8 0 0 1-8 8 16 16 0 0 1-16-16v-40a8 8 0 0 1 0-16 16 16 0 0 1 16 16v40a8 8 0 0 1 8 8m-32-92a12 12 0 1 1 12 12 12 12 0 0 1-12-12";
EXTRA_ICONS["EyeSlash"] = "M53.92 34.62a8 8 0 1 0-11.84 10.76l19.24 21.17C25 88.84 9.38 123.2 8.69 124.76a8 8 0 0 0 0 6.5c.35.79 8.82 19.57 27.65 38.4C61.43 194.74 93.12 208 128 208a127.1 127.1 0 0 0 52.07-10.83l22 24.21a8 8 0 1 0 11.84-10.76Zm47.33 75.84 41.67 45.85a32 32 0 0 1-41.67-45.85M128 192c-30.78 0-57.67-11.19-79.93-33.25A133.2 133.2 0 0 1 25 128c4.69-8.79 19.66-33.39 47.35-49.38l18 19.75a48 48 0 0 0 63.66 70l14.73 16.2A112 112 0 0 1 128 192m6-95.43a8 8 0 0 1 3-15.72 48.16 48.16 0 0 1 38.77 42.64 8 8 0 0 1-7.22 8.71 6 6 0 0 1-.75 0 8 8 0 0 1-8-7.26A32.09 32.09 0 0 0 134 96.57m113.28 34.69c-.42.94-10.55 23.37-33.36 43.8a8 8 0 1 1-10.67-11.92 132.8 132.8 0 0 0 27.8-35.14 133.2 133.2 0 0 0-23.12-30.77C185.67 75.19 158.78 64 128 64a118.4 118.4 0 0 0-19.36 1.57A8 8 0 1 1 106 49.79 134 134 0 0 1 128 48c34.88 0 66.57 13.26 91.66 38.35 18.83 18.83 27.3 37.62 27.65 38.41a8 8 0 0 1 0 6.5Z";
EXTRA_ICONS["Camera"] = "M208 56h-27.72l-13.63-20.44A8 8 0 0 0 160 32H96a8 8 0 0 0-6.65 3.56L75.71 56H48a24 24 0 0 0-24 24v112a24 24 0 0 0 24 24h160a24 24 0 0 0 24-24V80a24 24 0 0 0-24-24m8 136a8 8 0 0 1-8 8H48a8 8 0 0 1-8-8V80a8 8 0 0 1 8-8h32a8 8 0 0 0 6.66-3.56L100.28 48h55.43l13.63 20.44A8 8 0 0 0 176 72h32a8 8 0 0 1 8 8ZM128 88a44 44 0 1 0 44 44 44.05 44.05 0 0 0-44-44m0 72a28 28 0 1 1 28-28 28 28 0 0 1-28 28";
EXTRA_ICONS["Keyboard"] = "M224 48H32a16 16 0 0 0-16 16v128a16 16 0 0 0 16 16h192a16 16 0 0 0 16-16V64a16 16 0 0 0-16-16m0 144H32V64h192zm-16-64a8 8 0 0 1-8 8H56a8 8 0 0 1 0-16h144a8 8 0 0 1 8 8m0-32a8 8 0 0 1-8 8H56a8 8 0 0 1 0-16h144a8 8 0 0 1 8 8M72 160a8 8 0 0 1-8 8h-8a8 8 0 0 1 0-16h8a8 8 0 0 1 8 8m96 0a8 8 0 0 1-8 8H96a8 8 0 0 1 0-16h64a8 8 0 0 1 8 8m40 0a8 8 0 0 1-8 8h-8a8 8 0 0 1 0-16h8a8 8 0 0 1 8 8";
EXTRA_ICONS.CircleNotch = 'M236 128a108 108 0 0 1-216 0c0-42.52 24.73-81.34 63-98.9a12 12 0 1 1 10 21.81C63.24 64.57 44 94.83 44 128a84 84 0 0 0 168 0c0-33.17-19.24-63.43-49-77.09a12 12 0 1 1 10-21.81c38.27 17.56 63 56.38 63 98.9';
const CLAUDE_MARK = 'M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z';

let V = {};
let S = {};
let compPage = null;
let activeBuildGroup = null;

// ---------- helpers ----------
function P(name, opacity) {
  const v = V['color/' + name];
  if (!v) throw new Error('Missing variable color/' + name);
  const paint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: opacity === undefined ? 1 : opacity };
  // setBoundVariableForPaint drops the paint's opacity, so put it back afterwards.
  const bound = figma.variables.setBoundVariableForPaint(paint, 'color', v);
  return [Object.assign({}, bound, { opacity: paint.opacity })];
}
// Assigning a freshly bound paint drops its opacity; assigning the node's own paint back keeps it.
function PA(node, prop, name, opacity) {
  node[prop] = P(name, opacity);
  if (opacity !== undefined) node[prop] = node[prop].map(x => Object.assign({}, x, { opacity: opacity }));
}
function hex(h, opacity) {
  const c = h.replace('#', '');
  return [{ type: 'SOLID', opacity: opacity === undefined ? 1 : opacity, color: { r: parseInt(c.slice(0, 2), 16) / 255, g: parseInt(c.slice(2, 4), 16) / 255, b: parseInt(c.slice(4, 6), 16) / 255 } }];
}
function AL(dir, name, props) {
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = dir;
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.fills = [];
  f.clipsContent = false;
  if (props) Object.assign(f, props);
  return f;
}
function comp(name, dir, props) {
  const c = figma.createComponent();
  c.name = name;
  c.layoutMode = dir;
  c.primaryAxisSizingMode = 'AUTO';
  c.counterAxisSizingMode = 'AUTO';
  c.fills = [];
  if (props) Object.assign(c, props);
  return c;
}
async function T(chars, style, color, props) {
  const t = figma.createText();
  await t.setTextStyleIdAsync(S[style].id);
  t.characters = chars;
  t.fills = typeof color === 'string' ? P(color) : color;
  if (props) Object.assign(t, props);
  return t;
}
function rawText(chars, size, style, fills) {
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: style };
  t.fontSize = size;
  t.characters = chars;
  t.fills = fills;
  return t;
}
function sp(n, prop, key) { n.setBoundVariable(prop, V['spacing/' + key]); }
function pad(n, v, h) { sp(n, 'paddingTop', v); sp(n, 'paddingBottom', v); sp(n, 'paddingLeft', h); sp(n, 'paddingRight', h); }
function rad(n, key) {
  for (const c of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) n.setBoundVariable(c, V['radius/' + key]);
}
function fill(parent, child) { parent.appendChild(child); child.layoutSizingHorizontal = 'FILL'; return child; }
function wrapText(parent, t) { parent.appendChild(t); t.layoutSizingHorizontal = 'FILL'; t.textAutoResize = 'HEIGHT'; return t; }
function findComp(name) {
  const matches = figma.root.findAll(n => (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') && n.name === name);
  if (matches.length > 1) throw new Error('Duplicate component name "' + name + '"');
  return matches[0] || null;
}
function variant(setName, variantName) {
  const set = findComp(setName);
  if (!set) throw new Error('Missing component set ' + setName);
  const v = set.children.find(c => c.name === variantName);
  if (!v) throw new Error('Missing variant ' + setName + ' / ' + variantName);
  return v.createInstance();
}
function icon(name, size, color) {
  const c = findComp('Icon/' + name);
  if (!c) throw new Error('Missing icon ' + name);
  const i = c.createInstance();
  i.name = 'icon';
  i.resize(size, size);
  // Overriding with the variable the main already uses renders the paint's raw black, so skip that no-op.
  const same = typeof color === 'string' && c.children[0].fills[0].boundVariables && c.children[0].fills[0].boundVariables.color.id === V['color/' + color].id;
  if (!same) i.children[0].fills = typeof color === 'string' ? P(color) : color;
  return i;
}
// Text bound to a component property must be set through the property, not .characters.
function setInstanceText(inst, layerName, chars) {
  const t = inst.findOne(n => n.type === 'TEXT' && n.name === layerName);
  if (!t) return;
  const ref = t.componentPropertyReferences && t.componentPropertyReferences.characters;
  const owner = ref ? inst.findOne(n => n.type === 'INSTANCE' && n.componentProperties && n.componentProperties[ref]) || inst : null;
  if (ref && owner.componentProperties && owner.componentProperties[ref]) owner.setProperties({ [ref]: chars });
  else t.characters = chars;
}
function spacer() { const s = AL('HORIZONTAL', 'spacer'); s.counterAxisSizingMode = 'FIXED'; s.resize(1, 1); return s; }

function newSection(name, desc) {
  const bottom = Math.max(0, ...compPage.children.map(c => c.y + c.height));
  const s = figma.createSection();
  tagBuildNode(s);
  s.name = name;
  s.x = 0;
  s.y = bottom + 80;
  s.fills = P('bg/primary');
  const t = rawText(name, 24, 'Semi Bold', P('text/primary'));
  s.appendChild(t); t.x = 40; t.y = 32;
  const d = rawText(desc, 13, 'Regular', P('text/secondary'));
  s.appendChild(d); d.x = 40; d.y = 68; d.resize(900, d.height); d.textAutoResize = 'HEIGHT';
  return s;
}
function finishSet(set, sec, width, description) {
  set.description = description;
  set.layoutMode = 'HORIZONTAL';
  set.layoutWrap = 'WRAP';
  set.itemSpacing = 24;
  set.counterAxisSpacing = 24;
  set.counterAxisAlignItems = 'MIN';
  set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 24;
  set.primaryAxisSizingMode = 'FIXED';
  set.counterAxisSizingMode = 'AUTO';
  set.resize(width, set.height);
  set.fills = [];
  set.strokes = hex('#9966ff');
  set.dashPattern = [6, 4];
  set.cornerRadius = 8;
  set.x = 40;
  set.y = 120;
  sec.resizeWithoutConstraints(Math.max(width + 80, 1000), set.y + set.height + 40);
}

// ---------- steps ----------
async function ensureIcons() {
  const row = compPage.findOne(n => n.type === 'FRAME' && n.name === 'icons');
  for (const name of Object.keys(EXTRA_ICONS)) {
    if (findComp('Icon/' + name)) continue;
    const f = figma.createNodeFromSvg('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256"><path d="' + EXTRA_ICONS[name] + '" fill="#000"/></svg>');
    const c = figma.createComponent();
    c.name = 'Icon/' + name; c.resize(24, 24); c.fills = [];
    for (const ch of f.children.slice()) c.appendChild(ch);
    f.remove();
    const g = c.children.length === 1 ? c.children[0] : figma.flatten(c.children, c);
    g.name = 'glyph'; g.constraints = { horizontal: 'SCALE', vertical: 'SCALE' }; g.fills = P('text/primary');
    c.description = 'phosphor-react-native <' + name + ' />.';
    if (row) row.appendChild(c);
  }
  if (!findComp('Mark/Claude')) {
    const f = figma.createNodeFromSvg('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill-rule="evenodd" d="' + CLAUDE_MARK + '" fill="#000"/></svg>');
    const c = figma.createComponent();
    c.name = 'Mark/Claude'; c.resize(24, 24); c.fills = [];
    for (const ch of f.children.slice()) c.appendChild(ch);
    f.remove();
    const g = c.children.length === 1 ? c.children[0] : figma.flatten(c.children, c);
    g.name = 'glyph'; g.constraints = { horizontal: 'SCALE', vertical: 'SCALE' }; g.fills = P('border');
    c.description = 'PROVIDER_MARK_PATHS.claude (components/sessions/shared/ProviderMark.tsx).';
    if (row) row.appendChild(c);
  }
  const sec = compPage.findOne(n => n.type === 'SECTION' && n.name === 'Icons');
  if (sec && row) sec.resizeWithoutConstraints(Math.max(sec.width, row.width), sec.height);
}

async function buildBanner() {
  if (findComp('Banner')) return;
  const sec = newSection('Banner', 'components/ui/Banner.tsx — a centered modal card over a rgba(0,0,0,0.55) scrim. Card 240 wide (300 in list mode), gap 12, padding 16×24, radius 12, 1px border in the accent prop (stories: status.failed), bg-card. Buttons: padding 4×16, radius 8, border + bg-secondary; primary = accent border/label, destructive = text.danger.');
  const comps = [];
  for (const kind of ['Message', 'WithAction', 'List']) {
    const c = comp('Variant=' + kind, 'VERTICAL', { counterAxisAlignItems: 'CENTER', cornerRadius: 12, strokeWeight: 1 });
    c.counterAxisSizingMode = 'FIXED';
    c.resize(kind === 'List' ? 300 : 240, 100);
    c.primaryAxisSizingMode = 'AUTO';
    pad(c, 'lg', 'xl'); sp(c, 'itemSpacing', 'md');
    c.fills = P('bg/card'); c.strokes = P('status/failed');
    const title = await T(kind === 'List' ? 'Something went wrong' : 'Connection lost', 'label/base', 'text/primary', { name: 'title', textAlignHorizontal: 'CENTER' });
    wrapText(c, title);
    if (kind !== 'List') {
      const msg = await T('The server stopped responding.', 'body/sm', 'status/failed', { name: 'message', textAlignHorizontal: 'CENTER' });
      wrapText(c, msg);
    } else {
      const list = AL('VERTICAL', 'items'); sp(list, 'itemSpacing', 'sm');
      fill(c, list);
      for (const label of ['History failed to load', 'Sessions failed to load']) {
        const row = AL('HORIZONTAL', 'item', { counterAxisAlignItems: 'CENTER', cornerRadius: 8, strokeWeight: 1 });
        row.strokes = P('border'); pad(row, 'sm', 'md'); sp(row, 'itemSpacing', 'sm');
        fill(list, row);
        const t = await T(label, 'label/sm', 'text/primary', { name: 'item title' });
        fill(row, t);
        row.appendChild(icon('CaretRight', 12, 'status/failed'));
      }
    }
    if (kind !== 'Message') {
      const actions = AL('HORIZONTAL', 'actions'); sp(actions, 'itemSpacing', 'sm'); sp(actions, 'paddingTop', 'sm');
      fill(c, actions);
      const primary = kind === 'WithAction';
      const b = AL('HORIZONTAL', 'action', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', cornerRadius: 8, strokeWeight: 1 });
      pad(b, 'xs', 'lg'); b.fills = P('bg/secondary'); b.strokes = primary ? P('status/failed') : P('border');
      b.appendChild(await T(primary ? 'Details' : 'Close', 'label/sm', primary ? 'status/failed' : 'text/primary', { name: 'action label' }));
      fill(actions, b);
    }
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec);
  set.name = 'Banner';
  const k = set.addComponentProperty('Title', 'TEXT', 'Connection lost');
  for (const c of set.children) c.findOne(n => n.name === 'title').componentPropertyReferences = { characters: k };
  finishSet(set, sec, 700, 'components/ui/Banner.tsx. <Banner title message accent action secondaryAction items details />. Rendered centered over a 55% black scrim.');
}

async function buildEmptyState() {
  if (findComp('EmptyState')) return;
  const sec = newSection('EmptyState', 'components/ui/EmptyState.tsx — centered column, padding 24 horizontal, gap 8, bg-primary. Icon tile 44×44 radius 12 bg-secondary + border, Claude mark 20 filled with border. Title 17/600 (-0.2 tracking), subtitle 15/20 text.secondary. Primary button: min-height 44, radius 18, text.accent fill, Plus 14 + 13/600 label in bg.primary.');
  const comps = [];
  for (const action of ['None', 'Primary']) {
    const c = comp('Action=' + action, 'VERTICAL', { counterAxisAlignItems: 'CENTER', primaryAxisAlignItems: 'CENTER' });
    c.counterAxisSizingMode = 'FIXED'; c.resize(360, 200); c.primaryAxisSizingMode = 'AUTO';
    sp(c, 'paddingLeft', 'xl'); sp(c, 'paddingRight', 'xl'); sp(c, 'paddingTop', 'xxl'); sp(c, 'paddingBottom', 'xxl'); sp(c, 'itemSpacing', 'sm');
    c.fills = P('bg/primary');
    const tile = AL('HORIZONTAL', 'icon tile', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', cornerRadius: 12, strokeWeight: 1 });
    tile.primaryAxisSizingMode = 'FIXED'; tile.counterAxisSizingMode = 'FIXED'; tile.resize(44, 44);
    tile.fills = P('bg/secondary'); tile.strokes = P('border');
    const mark = findComp('Mark/Claude').createInstance(); mark.resize(20, 20); tile.appendChild(mark);
    c.appendChild(tile);
    const title = await T(action === 'None' ? 'No sessions yet' : 'No sessions', 'label/lg', 'text/primary', { name: 'title', textAlignHorizontal: 'CENTER', letterSpacing: { unit: 'PIXELS', value: -0.2 } });
    wrapText(c, title);
    const sub = await T(action === 'None' ? 'Start a session on a connected server to see it here.' : 'Start a Claude Code or Codex session to see it here', 'body/base', 'text/secondary', { name: 'subtitle', textAlignHorizontal: 'CENTER' });
    wrapText(c, sub);
    if (action === 'Primary') {
      const row = AL('HORIZONTAL', 'actions'); sp(row, 'itemSpacing', 'sm'); sp(row, 'paddingTop', 'sm');
      c.appendChild(row);
      const b = AL('HORIZONTAL', 'primary', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', cornerRadius: 18, minHeight: 44 });
      sp(b, 'paddingLeft', 'md'); sp(b, 'paddingRight', 'md'); sp(b, 'itemSpacing', 'sm');
      b.fills = P('text/accent');
      b.appendChild(icon('Plus-bold', 14, 'bg/primary'));
      b.appendChild(await T('New session', 'label/sm', 'bg/primary', { name: 'action label' }));
      row.appendChild(b);
    }
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec);
  set.name = 'EmptyState';
  const kT = set.addComponentProperty('Title', 'TEXT', 'No sessions');
  const kS = set.addComponentProperty('Subtitle', 'TEXT', 'Start a Claude Code or Codex session to see it here');
  const kShow = set.addComponentProperty('Show subtitle', 'BOOLEAN', true);
  for (const c of set.children) {
    c.findOne(n => n.name === 'title').componentPropertyReferences = { characters: kT };
    c.findOne(n => n.name === 'subtitle').componentPropertyReferences = { characters: kS, visible: kShow };
  }
  finishSet(set, sec, 840, 'components/ui/EmptyState.tsx. <EmptyState title subtitle action={{label, plus}} secondaryAction />.');
}

async function buildFAB() {
  if (findComp('FAB')) return;
  const sec = newSection('FAB', 'components/ui/FAB.tsx — pill 44 high, radius 22, padding 18 (14 collapsed), text.accent fill, 1px accent@35% border, accent glow (shadow opacity 0.6, blur 6; halo pulses 8%→18%). Plus 16 bold + "New session" 13/600 in bg.primary. Absolute: right 20, bottom 24 + safe area.');
  const comps = [];
  for (const collapsed of [false, true]) {
    const c = comp('Collapsed=' + collapsed, 'HORIZONTAL', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', cornerRadius: 22, strokeWeight: 1 });
    c.counterAxisSizingMode = 'FIXED'; c.resize(100, 44); c.primaryAxisSizingMode = 'AUTO';
    c.paddingLeft = c.paddingRight = collapsed ? 14 : 18;
    sp(c, 'itemSpacing', 'sm');
    c.fills = P('text/accent'); PA(c, 'strokes', 'text/accent', 0.35);
    c.effects = [{ type: 'DROP_SHADOW', color: { r: 0x58 / 255, g: 0xa6 / 255, b: 1, a: 0.6 }, offset: { x: 0, y: 0 }, radius: 6, spread: 0, visible: true, blendMode: 'NORMAL' }];
    c.appendChild(icon('Plus-bold', 16, 'bg/primary'));
    if (!collapsed) c.appendChild(await T('New session', 'label/sm', 'bg/primary', { name: 'label' }));
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec);
  set.name = 'FAB';
  finishSet(set, sec, 400, 'components/ui/FAB.tsx. <FAB collapsed onPress />. Glow color is the dark accent; the halo pulse is not representable statically.');
}

async function buildStateBadge() {
  if (findComp('StateBadge')) return;
  const sec = newSection('StateBadge + ServerChip', 'components/sessions/now — StateBadge: dot 7 + 11/500 label in the tier color, gap 4. ServerChip (label): pill, 1px border in the server color, fill at 12%, 9/600 text, +0.4 tracking. Server palette: components/sessions/shared/serverPalette.ts.');
  const TIERS = { needsYou: ['status/waiting', 'Needs you'], working: ['status/running', 'Working'], observed: ['status/completed', 'Observed'], cantResume: ['status/failed', "Can't resume"], resumable: ['status/idle', 'Resumable'] };
  const comps = [];
  for (const tier of Object.keys(TIERS)) {
    const color = TIERS[tier][0];
    const c = comp('Tier=' + tier, 'HORIZONTAL', { counterAxisAlignItems: 'CENTER' });
    sp(c, 'itemSpacing', 'xs');
    const dot = figma.createEllipse(); dot.name = 'dot'; dot.resize(7, 7); dot.fills = P(color);
    c.appendChild(dot);
    c.appendChild(await T(TIERS[tier][1], 'label/xs-medium', color, { name: 'label' }));
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec);
  set.name = 'StateBadge';
  finishSet(set, sec, 700, 'StateBadge (components/sessions/now). The dot pulses when live. Label text is overridable, e.g. "Working · 5s".');
  const chip = comp('ServerChip', 'HORIZONTAL', { counterAxisAlignItems: 'CENTER', strokeWeight: 1 });
  chip.paddingLeft = chip.paddingRight = 6; chip.paddingTop = chip.paddingBottom = 2;
  rad(chip, 'full');
  chip.strokes = hex(SERVER_PALETTE[0]); chip.fills = hex(SERVER_PALETTE[0], 0.12);
  const t = rawText('studio-linux', 9, 'Semi Bold', hex(SERVER_PALETTE[0]));
  t.name = 'label'; t.letterSpacing = { unit: 'PIXELS', value: 0.4 };
  chip.appendChild(t);
  chip.description = 'ServerChip label variant. Recolor border/fill/text with the server palette color (#63b3ff #4ade80 #22d3ee #a78bfa #fb7185 #fbbf24 #a3a3a3 #f08a24).';
  const k = chip.addComponentProperty('Label', 'TEXT', 'studio-linux');
  t.componentPropertyReferences = { characters: k };
  sec.appendChild(chip);
  chip.x = 40; chip.y = set.y + set.height + 24;
  sec.resizeWithoutConstraints(sec.width, chip.y + chip.height + 40);
}

async function buildLiveCard() {
  if (findComp('LiveCard')) return;
  const sec = newSection('LiveCard', 'components/sessions/now/LiveCard.tsx + NeedsYouCard / WorkingCard. bg-secondary, radius 12, 1px border (solid: rail@50%, faint: accent@18%), 3px state rail, body padding 12 gap 7. Title 15/600 up to 2 lines. Needs-you: terminal tail box (mono 11, bg-primary, border, radius 6, 7×8 padding) + footer. Working: 2px sweep bar, 34% segment loops 1600ms.');
  const comps = [];
  for (const kind of ['NeedsYou', 'Working']) {
    const needs = kind === 'NeedsYou';
    const rail = needs ? 'status/waiting' : 'status/running';
    const c = comp('Kind=' + kind, 'HORIZONTAL', { cornerRadius: 12, strokeWeight: 1, clipsContent: true });
    c.primaryAxisSizingMode = 'FIXED'; c.resize(370, 100); c.counterAxisSizingMode = 'AUTO';
    c.fills = P('bg/secondary'); if (needs) PA(c, 'strokes', rail, 0.5); else PA(c, 'strokes', 'text/accent', 0.18);
    const r = figma.createRectangle(); r.name = 'rail'; r.resize(3, 100); r.fills = P(rail);
    c.appendChild(r); r.layoutSizingVertical = 'FILL';
    const body = AL('VERTICAL', 'body'); pad(body, 'md', 'md'); body.itemSpacing = 7;
    fill(c, body);
    const title = await T(needs ? 'storefront · feat/guest-checkout-recovery' : 'ledger-api · feat/idempotent-reconciliation', 'label/base', 'text/primary', { name: 'title' });
    wrapText(body, title);
    const badge = variant('StateBadge', needs ? 'Tier=needsYou' : 'Tier=working');
    setInstanceText(badge, 'label', needs ? 'Needs you' : 'Working · 5s');
    body.appendChild(badge);
    if (needs) {
      const tail = AL('VERTICAL', 'terminal tail', { cornerRadius: 6, strokeWeight: 1 });
      tail.paddingTop = tail.paddingBottom = 7; tail.paddingLeft = tail.paddingRight = 8;
      tail.fills = P('bg/primary'); tail.strokes = P('border');
      fill(body, tail);
      wrapText(tail, await T('Waiting for migration review', 'mono/xs', 'text/primary', { name: 'tail' }));
      const foot = AL('HORIZONTAL', 'footer', { counterAxisAlignItems: 'CENTER' }); sp(foot, 'itemSpacing', 'sm');
      fill(body, foot);
      foot.appendChild(await T('apps/storefront', 'mono/xs', 'text/secondary', { name: 'project' }));
      foot.appendChild(await T('·', 'mono/xs', 'text/secondary', { opacity: 0.45 }));
      foot.appendChild(await T('feat/guest-checkout…', 'mono/xs', 'text/secondary', { name: 'branch' }));
      fill(foot, spacer());
      foot.appendChild(await T('Open →', 'label/xs', 'text/accent', { name: 'open' }));
    } else {
      const track = figma.createFrame(); track.name = 'sweep'; track.resize(300, 2); track.cornerRadius = 1; track.fills = P('bg/primary'); track.clipsContent = true;
      fill(body, track);
      const bar = figma.createRectangle(); bar.name = 'bar'; bar.resize(Math.round(track.width * 0.34), 2); bar.cornerRadius = 1; bar.fills = P('status/running');
      track.appendChild(bar); bar.x = track.width - bar.width; bar.y = 0;
      bar.constraints = { horizontal: 'MAX', vertical: 'MIN' };
    }
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec);
  set.name = 'LiveCard';
  const k = set.addComponentProperty('Title', 'TEXT', 'storefront · feat/guest-checkout-recovery');
  for (const c of set.children) c.findOne(n => n.name === 'title').componentPropertyReferences = { characters: k };
  finishSet(set, sec, 880, 'LiveCard shell with NeedsYouCard (solid, status.waiting) and WorkingCard (faint, status.running) content. ProviderMark / ServerChip follow the title when shown.');
}

async function buildEarlierRow() {
  if (findComp('EarlierRow')) return;
  const sec = newSection('EarlierRow', 'components/sessions/shared/ConversationListItem.tsx, compact density (min-height 48, 6×12 padding, gap 8). Left strip 3 wide, radius 2 (server color / live tier color, else transparent). Title 13/600 one line, meta 11 text.secondary, trailing time 11/500.');
  const comps = [];
  for (const state of ['Resumable', 'Plain']) {
    const c = comp('State=' + state, 'HORIZONTAL', { counterAxisAlignItems: 'CENTER', minHeight: 48 });
    c.primaryAxisSizingMode = 'FIXED'; c.resize(370, 48); c.counterAxisSizingMode = 'AUTO';
    c.paddingTop = c.paddingBottom = 6; sp(c, 'paddingLeft', 'md'); sp(c, 'paddingRight', 'md'); sp(c, 'itemSpacing', 'sm');
    const strip = figma.createRectangle(); strip.name = 'strip'; strip.resize(3, 32); strip.cornerRadius = 2; strip.fills = [];
    c.appendChild(strip);
    const col = AL('VERTICAL', 'text', { itemSpacing: 2 });
    fill(c, col);
    const title = await T(state === 'Resumable' ? 'storefront · fix/cart-price-cache' : 'Conversation', 'label/sm', 'text/primary', { name: 'title' });
    fill(col, title);
    // Matches the reference: a conversation with no title or timestamp renders "Conversation" alone.
    if (state === 'Resumable') {
      col.appendChild(variant('StateBadge', 'Tier=resumable'));
      c.appendChild(await T('1 May 11:01', 'label/xs-medium', 'text/secondary', { name: 'time' }));
    }
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec);
  set.name = 'EarlierRow';
  const k = set.addComponentProperty('Title', 'TEXT', 'storefront · fix/cart-price-cache');
  for (const c of set.children) c.findOne(n => n.name === 'title').componentPropertyReferences = { characters: k };
  finishSet(set, sec, 880, 'EarlierRow → ConversationListItem (compact, no leading slot).');
}

async function buildServerListCard() {
  if (findComp('ServerListCard')) return;
  const sec = newSection('ServerListCard', 'components/servers/ServerListCard.tsx — bg-card, radius 10, border, padding 12 (bottom 8). Header: 8px status dot, 15/600 label, 32×32 icon buttons (Trash text.danger, PencilSimple text.accent, ArrowsClockwise text.secondary; Info fill text.danger on error). URL mono 11, meta 11 text.secondary, both indented 16.');
  const comps = [];
  for (const connected of [true, false]) {
    const c = comp('Connected=' + connected, 'VERTICAL', { strokeWeight: 1, clipsContent: true });
    c.counterAxisSizingMode = 'FIXED'; c.resize(370, 100); c.primaryAxisSizingMode = 'AUTO';
    sp(c, 'paddingTop', 'md'); sp(c, 'paddingLeft', 'md'); sp(c, 'paddingRight', 'md'); sp(c, 'paddingBottom', 'sm');
    rad(c, 'md'); c.fills = P('bg/card'); c.strokes = P('border');
    const head = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER' }); sp(head, 'itemSpacing', 'sm'); sp(head, 'paddingBottom', 'xs');
    fill(c, head);
    const dot = figma.createEllipse(); dot.name = 'status'; dot.resize(8, 8); dot.fills = P(connected ? 'status/running' : 'status/failed');
    head.appendChild(dot);
    fill(head, await T('Home Mac', 'label/base', 'text/primary', { name: 'label' }));
    const btns = AL('HORIZONTAL', 'actions', { itemSpacing: 2 });
    head.appendChild(btns);
    const defs = connected ? [['Trash', 'text/danger'], ['PencilSimple', 'text/accent'], ['ArrowsClockwise', 'text/secondary']] : [['Info-fill', 'text/danger'], ['Trash', 'text/danger'], ['PencilSimple', 'text/accent'], ['ArrowsClockwise', 'text/secondary']];
    for (const [name, color] of defs) {
      const b = AL('HORIZONTAL', name, { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER' });
      b.primaryAxisSizingMode = 'FIXED'; b.counterAxisSizingMode = 'FIXED'; b.resize(32, 32); rad(b, 'sm');
      b.appendChild(icon(name, 20, color));
      btns.appendChild(b);
    }
    const url = await T('https://home-mac.local:7071', 'mono/xs', 'text/secondary', { name: 'url' });
    const urlRow = AL('HORIZONTAL', 'url row'); sp(urlRow, 'paddingLeft', 'lg'); urlRow.paddingBottom = 2;
    fill(c, urlRow); fill(urlRow, url);
    const meta = await T(connected ? 'home-mac · darwin · v1.4.2' : 'Disconnected', 'body/xs', 'text/secondary', { name: 'meta' });
    const metaRow = AL('HORIZONTAL', 'meta row'); sp(metaRow, 'paddingLeft', 'lg'); sp(metaRow, 'paddingBottom', 'xs');
    fill(c, metaRow); fill(metaRow, meta);
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec);
  set.name = 'ServerListCard';
  const k = set.addComponentProperty('Label', 'TEXT', 'Home Mac');
  for (const c of set.children) c.findOne(n => n.name === 'label').componentPropertyReferences = { characters: k };
  finishSet(set, sec, 880, 'components/servers/ServerListCard.tsx. States not shown: refreshing (accent strip, ArrowsClockwise at 40%) and the success/error strip that fades after 2.5s.');
}

// ---------- screens ----------
// ---------- batch 1: ui/ + sessions/shared/ ----------
const PROVIDER_PATHS = {
  Claude: CLAUDE_MARK,
  Codex: 'M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z',
  Cursor: 'M22.106 5.68L12.5.135a.998.998 0 00-.998 0L1.893 5.68a.84.84 0 00-.419.726v11.186c0 .3.16.577.42.727l9.607 5.547a.999.999 0 00.998 0l9.608-5.547a.84.84 0 00.42-.727V6.407a.84.84 0 00-.42-.726zm-.603 1.176L12.228 22.92c-.063.108-.228.064-.228-.061V12.34a.59.59 0 00-.295-.51l-9.11-5.26c-.107-.062-.063-.228.062-.228h18.55c.264 0 .428.286.296.514z',
};
function svgGlyph(path, size, fills) {
  const f = figma.createNodeFromSvg('<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24"><path fill-rule="evenodd" d="' + path + '" fill="#000"/></svg>');
  const g = f.children.length === 1 ? f.children[0] : figma.flatten(f.children, f);
  g.name = 'glyph'; g.fills = fills;
  return f;
}

async function buildProviderMark() {
  if (findComp('ProviderMark')) return;
  const sec = newSection('ProviderMark', 'components/sessions/shared/ProviderMark.tsx — 22×22 tile, radius sm, bg-card, 13px mark centered. mono (lists) = text.secondary; color (session header) = PROVIDER_COLOR. Paths from assets/icons/providers (lobe-icons, MIT).');
  const comps = [];
  for (const prov of ['Claude', 'Codex', 'Cursor']) for (const tone of ['Mono', 'Color']) {
    const c = comp('Provider=' + prov + ', Variant=' + tone, 'HORIZONTAL', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER' });
    c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED'; c.resize(22, 22);
    rad(c, 'sm'); c.fills = P('bg/card');
    const brand = V['color/brand/' + prov.toLowerCase()];
    const fills = tone === 'Mono' || !brand ? P('text/secondary') : [figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', brand)];
    const g = svgGlyph(PROVIDER_PATHS[prov], 13, fills); g.name = 'mark'; g.fills = [];
    c.appendChild(g);
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec);
  set.name = 'ProviderMark';
  finishSet(set, sec, 400, 'components/sessions/shared/ProviderMark.tsx. <ProviderMark provider variant="mono|color" size={22} />.');
}

async function buildSkeleton() {
  if (findComp('SkeletonBox')) return;
  const sec = newSection('SkeletonBox', 'components/ui/Skeleton.tsx — a theme.border block, radius sm (overridable), height 14 by default. Opacity pulses 0.35 ↔ 0.85 over 650 ms; shown here at 0.6.');
  const c = comp('SkeletonBox', 'HORIZONTAL');
  c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED'; c.resize(240, 14);
  rad(c, 'sm'); PA(c, 'fills', 'border', 0.6);
  c.description = 'components/ui/Skeleton.tsx. <SkeletonBox width height={14} borderRadius />. Resize freely.';
  sec.appendChild(c); c.x = 40; c.y = 120;
  sec.resizeWithoutConstraints(1000, 200);
}

async function buildTimeBucketPills() {
  if (findComp('TimeBucketPill')) return;
  const sec = newSection('TimeBucketPills', 'components/sessions/shared/TimeBucketPills.tsx — pill: 6×12 padding, gap 6, radius full, 1px border, bg-secondary; label 11/600 text.secondary; count 10/600 at 70%. Active: accent @12% fill, accent border, label + count in accent. Row: 8×12 padding, gap 6, horizontal scroll.');
  const comps = [];
  for (const state of ['Default', 'Active']) {
    const on = state === 'Active';
    const c = comp('State=' + state, 'HORIZONTAL', { counterAxisAlignItems: 'CENTER', itemSpacing: 6, strokeWeight: 1 });
    c.paddingTop = c.paddingBottom = 6; sp(c, 'paddingLeft', 'md'); sp(c, 'paddingRight', 'md');
    rad(c, 'full');
    if (on) PA(c, 'fills', 'text/accent', 0.12); else c.fills = P('bg/secondary');
    c.strokes = on ? P('text/accent') : P('border');
    c.appendChild(await T('All', 'label/xs', on ? 'text/accent' : 'text/secondary', { name: 'label' }));
    const wrap = AL('HORIZONTAL', 'count'); wrap.paddingLeft = wrap.paddingRight = 5; wrap.paddingTop = wrap.paddingBottom = 1;
    const n = rawText('128', 10, 'Semi Bold', on ? P('text/accent') : P('text/secondary'));
    n.name = 'count'; if (!on) n.opacity = 0.7;
    wrap.appendChild(n); c.appendChild(wrap);
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec);
  set.name = 'TimeBucketPill';
  const kl = set.addComponentProperty('Label', 'TEXT', 'All');
  const kc = set.addComponentProperty('Count', 'TEXT', '128');
  const kb = set.addComponentProperty('Show count', 'BOOLEAN', true);
  for (const c of set.children) {
    c.findOne(n => n.type === 'TEXT' && n.name === 'label').componentPropertyReferences = { characters: kl };
    c.findOne(n => n.type === 'TEXT' && n.name === 'count').componentPropertyReferences = { characters: kc };
    c.findOne(n => n.type === 'FRAME' && n.name === 'count').componentPropertyReferences = { visible: kb };
  }
  finishSet(set, sec, 400, 'One pill of TimeBucketPills. Counts ≥ 1000 render as 1.2k.');
  const row = comp('TimeBucketPills', 'HORIZONTAL', { itemSpacing: 6 });
  sp(row, 'paddingTop', 'sm'); sp(row, 'paddingBottom', 'sm'); sp(row, 'paddingLeft', 'md'); sp(row, 'paddingRight', 'md');
  const data = [['All', '128', 'Active'], ['Today', '4'], ['7d', '31'], ['30d', '96'], ['Custom', null]];
  for (const [label, count, st] of data) {
    const i = variant('TimeBucketPill', 'State=' + (st || 'Default'));
    const props = {};
    for (const key of Object.keys(i.componentProperties)) {
      if (key.indexOf('Label') === 0) props[key] = label;
      if (key.indexOf('Count') === 0) props[key] = count || '';
      if (key.indexOf('Show count') === 0) props[key] = !!count;
    }
    i.setProperties(props);
    row.appendChild(i);
  }
  row.description = 'components/sessions/shared/TimeBucketPills.tsx. <TimeBucketPills active counts onChange showCustom />.';
  sec.appendChild(row); row.x = 480; row.y = 120;
}

async function buildMessagePreview() {
  if (findComp('MessagePreview')) return;
  const sec = newSection('MessagePreview', 'components/sessions/shared/MessagePreview.tsx — 11/15 text.secondary, one line, 80-char cap with …. Search: the matched range is text.primary on accent @22%; a /api/search snippet may wrap to two lines.');
  const comps = [];
  for (const kind of ['Plain', 'Match']) {
    const c = comp('Kind=' + kind, 'HORIZONTAL', { counterAxisAlignItems: 'CENTER', itemSpacing: 3 });
    c.primaryAxisSizingMode = 'FIXED'; c.resize(320, 15);
    if (kind === 'Plain') {
      fill(c, await T('Run the migration again after the cart cache is warmed…', 'body/xs', 'text/secondary', { name: 'preview', textTruncation: 'ENDING', maxLines: 1 }));
    } else {
      c.appendChild(await T('…then re-run the', 'body/xs', 'text/secondary', { name: 'before' }));
      const hl = AL('HORIZONTAL', 'match'); PA(hl, 'fills', 'text/accent', 0.22);
      hl.appendChild(await T('migration', 'body/xs', 'text/primary', { name: 'match text' }));
      c.appendChild(hl);
      c.appendChild(await T('once the cache is warm', 'body/xs', 'text/secondary', { name: 'after' }));
    }
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec);
  set.name = 'MessagePreview';
  finishSet(set, sec, 400, 'components/sessions/shared/MessagePreview.tsx. <MessagePreview mode firstMessage lastMessage preview highlight matches rowTitle />. Renders nothing when the preview only echoes the title.');
}

async function buildLoadingOverlay() {
  if (findComp('LoadingOverlay')) return;
  const sec = newSection('LoadingOverlay', 'components/ui/LoadingOverlay.tsx — centered over a rgba(13,17,23,0.55) scrim. Card: bg-card, radius 16, 16 side / 12 top / 16 bottom padding, min-width 240, shadow 0 6 12 @30%. CircleNotch bold 28 accent, spins 900 ms. Progress row 192 wide: label 13/600 + count 11 secondary, 6px track (border) with accent fill.');
  const comps = [];
  for (const state of ['Fetching', 'Progress', 'Done']) {
    const c = comp('State=' + state, 'VERTICAL', { counterAxisAlignItems: 'CENTER', itemSpacing: 8, cornerRadius: 16, minWidth: 240 });
    sp(c, 'paddingTop', 'md'); sp(c, 'paddingBottom', 'lg'); sp(c, 'paddingLeft', 'lg'); sp(c, 'paddingRight', 'lg');
    c.fills = P('bg/card');
    c.effects = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.3 }, offset: { x: 0, y: 6 }, radius: 12, spread: 0, visible: true, blendMode: 'NORMAL' }];
    c.appendChild(icon('CircleNotch', 28, 'text/accent'));
    c.appendChild(await T(state === 'Fetching' ? 'Fetching 3 servers in parallel' : 'Fetching', 'body/xs', 'text/secondary', { name: 'fetching' }));
    if (state !== 'Fetching') {
      const row = AL('VERTICAL', 'progress', { itemSpacing: 4 }); sp(row, 'paddingTop', 'md');
      row.counterAxisSizingMode = 'FIXED'; row.resize(192, 10); row.primaryAxisSizingMode = 'AUTO';
      c.appendChild(row);
      const labels = AL('HORIZONTAL', 'labels', { counterAxisAlignItems: 'CENTER' });
      fill(row, labels);
      labels.appendChild(await T('Sessions', 'label/sm', 'text/primary', { name: 'label' }));
      fill(labels, spacer());
      labels.appendChild(await T(state === 'Done' ? 'Done' : '12 of 40', 'body/xs', 'text/secondary', { name: 'count' }));
      const track = figma.createFrame(); track.name = 'track'; track.resize(192, 6); track.fills = P('border'); rad(track, 'full'); track.clipsContent = true;
      fill(row, track);
      const bar = figma.createRectangle(); bar.name = 'fill'; bar.resize(state === 'Done' ? 192 : Math.round(192 * 12 / 40), 6); bar.fills = P('text/accent'); rad(bar, 'full');
      track.appendChild(bar); bar.x = 0; bar.y = 0;
    }
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec);
  set.name = 'LoadingOverlay';
  finishSet(set, sec, 880, 'components/ui/LoadingOverlay.tsx. <LoadingOverlay visible done loaded total inFlightCount progressLabel="sessions|conversations" />. Card only; the scrim is not part of the component.');
}

// ---------- batch 2: components/sessions ----------
function dot(size, color, opacity) {
  const e = figma.createEllipse(); e.name = 'dot'; e.resize(size, size);
  if (typeof color === 'string') PA(e, 'fills', color, opacity); else e.fills = color;
  return e;
}
function hrule(parent, color, opacity) {
  const r = figma.createRectangle(); r.name = 'rule'; r.resize(10, 1); PA(r, 'fills', color, opacity);
  parent.appendChild(r); r.layoutGrow = 1;
  return r;
}
function inst(name, variantName) {
  const n = findComp(name);
  if (!n) throw new Error('Missing component ' + name);
  if (n.type === 'COMPONENT') return n.createInstance();
  return variantName ? variant(name, variantName) : n.defaultVariant.createInstance();
}
// List rows sit on bg-primary; without it their primary text vanishes on the white canvas.
function rowComp(name, width, props) {
  const c = comp(name, 'HORIZONTAL', Object.assign({ counterAxisAlignItems: 'CENTER' }, props));
  c.fills = P('bg/primary');
  c.primaryAxisSizingMode = 'FIXED'; c.resize(width, 20); c.counterAxisSizingMode = 'AUTO';
  return c;
}
function upper(t, tracking) { t.textCase = 'UPPER'; t.letterSpacing = { unit: 'PIXELS', value: tracking }; return t; }
const TONE = { Running: 'status/running', Waiting: 'status/waiting', Idle: 'status/idle' };

async function buildLiveDot() {
  if (findComp('LiveDot')) return;
  const sec = newSection('LiveDot', 'components/sessions/LiveDot.tsx — a circle (size 7 by default) in the caller\'s tone; opacity pulses 0.4 ↔ 1 over 1.6 s when live, static under reduce-motion.');
  const comps = [];
  for (const tone of Object.keys(TONE)) { const c = comp('Tone=' + tone, 'HORIZONTAL'); c.appendChild(dot(7, TONE[tone])); comps.push(c); }
  const set = figma.combineAsVariants(comps, sec); set.name = 'LiveDot';
  finishSet(set, sec, 300, 'components/sessions/LiveDot.tsx. <LiveDot live color size={7} />.');
}

async function buildSectionEyebrow() {
  if (findComp('SectionEyebrow')) return;
  const sec = newSection('SectionEyebrow', 'components/sessions/now/SectionEyebrow.tsx — row gap 8, padding 16 top / 10 bottom / 4 sides. Label mono 11/600, 1.5 tracking, in the tone (needsYou = status.waiting, working = status.running, muted = text.secondary). Live tones: 8px LiveDot + 1px rule in the tone @28%. Muted: rule in border + trailing mono count. Optional action link 11/600 accent.');
  const comps = [];
  for (const [tone, label, color, count] of [['NeedsYou', 'Needs you · 1', 'status/waiting'], ['Working', 'Working · 2', 'status/running'], ['Muted', 'Earlier', 'text/secondary', '12']]) {
    const c = rowComp('Tone=' + tone, 360); sp(c, 'itemSpacing', 'sm');
    sp(c, 'paddingTop', 'lg'); c.paddingBottom = 10; sp(c, 'paddingLeft', 'xs'); sp(c, 'paddingRight', 'xs');
    if (!count) c.appendChild(dot(8, color));
    c.appendChild(upper(await T(label, 'mono/xs', color, { name: 'label' }), 1.5));
    if (count) hrule(c, 'border'); else hrule(c, color, 0.28);
    if (count) c.appendChild(await T(count, 'mono/xs', 'text/secondary', { name: 'count' }));
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'SectionEyebrow';
  finishSet(set, sec, 440, 'components/sessions/now/SectionEyebrow.tsx. <SectionEyebrow tone label count action />.');
}

async function buildHistorySkeletonRow() {
  if (findComp('HistorySkeletonRow')) return;
  const sec = newSection('HistorySkeletonRow', 'components/sessions/now/HistorySkeletonRow.tsx — min height 46, padding 10×4, gap 8, radius md, bg-secondary, 1px border. Two 8px bg-card bars (radius 4) at 72% and 40% width.');
  const c = comp('HistorySkeletonRow', 'VERTICAL', { primaryAxisAlignItems: 'CENTER', strokeWeight: 1, minHeight: 46 });
  c.counterAxisSizingMode = 'FIXED'; c.resize(360, 46); c.primaryAxisSizingMode = 'AUTO';
  c.paddingTop = c.paddingBottom = 10; sp(c, 'paddingLeft', 'xs'); sp(c, 'paddingRight', 'xs'); sp(c, 'itemSpacing', 'sm');
  rad(c, 'md'); c.fills = P('bg/secondary'); c.strokes = P('border');
  for (const [name, pct] of [['title', 0.72], ['meta', 0.4]]) {
    const b = figma.createRectangle(); b.name = name; b.resize(Math.round(352 * pct), 8); b.cornerRadius = 4; b.fills = P('bg/card'); c.appendChild(b);
  }
  c.description = 'components/sessions/now/HistorySkeletonRow.tsx. Placeholder for an Earlier row while history loads.';
  sec.appendChild(c); c.x = 40; c.y = 120;
  sec.resizeWithoutConstraints(1000, 220);
}

async function buildCantResumeRow() {
  if (findComp('CantResumeRow')) return;
  const sec = newSection('CantResumeRow', 'components/sessions/now/CantResumeRow.tsx — gap 9, min height 44, padding 8×4, bottom hairline in accent @9%. Title 13/600 text.secondary, reason 11 status.failed, time mono 11 secondary.');
  const comps = [];
  for (const [kind, reason] of [['Generic', 'Can\'t resume'], ['WorktreeGone', 'Worktree gone — can\'t resume']]) {
    const c = rowComp('Reason=' + kind, 360, { itemSpacing: 9, minHeight: 44, strokeBottomWeight: 1, strokeTopWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 });
    sp(c, 'paddingTop', 'sm'); sp(c, 'paddingBottom', 'sm'); sp(c, 'paddingLeft', 'xs'); sp(c, 'paddingRight', 'xs');
    PA(c, 'strokes', 'text/accent', 0.09);
    const body = AL('VERTICAL', 'body', { itemSpacing: 2 }); c.appendChild(body); body.layoutGrow = 1;
    fill(body, await T('storefront · spike/edge-cache', 'label/sm', 'text/secondary', { name: 'title', textTruncation: 'ENDING', maxLines: 1 }));
    fill(body, await T(reason, 'body/xs', 'status/failed', { name: 'reason' }));
    c.appendChild(await T('3d', 'mono/xs', 'text/secondary', { name: 'time' }));
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'CantResumeRow';
  finishSet(set, sec, 440, 'components/sessions/now/CantResumeRow.tsx. <CantResumeRow title reason timestamp onPress onLongPress />.');
}

async function buildDrillFolderRow() {
  if (findComp('DrillFolderRow')) return;
  const sec = newSection('DrillFolderRow', 'components/sessions/tree/DrillFolderRow.tsx — gap 9, min height 44, padding 8×4. 7px dot (LiveDot when a session inside is live), name mono 13 primary, count pill (radius full, 1px border, 3×8, mono 11 secondary), time mono 11 secondary.');
  const comps = [];
  for (const [state, color] of [['Live', 'status/running'], ['Idle', 'status/idle']]) {
    const c = rowComp('State=' + state, 360, { itemSpacing: 9, minHeight: 44 });
    sp(c, 'paddingTop', 'sm'); sp(c, 'paddingBottom', 'sm'); sp(c, 'paddingLeft', 'xs'); sp(c, 'paddingRight', 'xs');
    c.appendChild(dot(7, color));
    const name = await T(state === 'Live' ? 'services/ledger' : 'apps/storefront', 'mono/sm', 'text/primary', { name: 'name', textTruncation: 'ENDING', maxLines: 1 });
    c.appendChild(name); name.layoutGrow = 1;
    const pill = AL('HORIZONTAL', 'pill', { strokeWeight: 1, paddingTop: 3, paddingBottom: 3 }); sp(pill, 'paddingLeft', 'sm'); sp(pill, 'paddingRight', 'sm');
    rad(pill, 'full'); pill.strokes = P('border');
    pill.appendChild(await T(state === 'Live' ? '4' : '17', 'mono/xs', 'text/secondary', { name: 'count' }));
    c.appendChild(pill);
    c.appendChild(await T(state === 'Live' ? '2m' : '5d', 'mono/xs', 'text/secondary', { name: 'time' }));
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'DrillFolderRow';
  finishSet(set, sec, 440, 'components/sessions/tree/DrillFolderRow.tsx. <DrillFolderRow name count time live color onPress />.');
}

const SCANNER_COLORS = ['status/running', 'text/accent', 'status/waiting', 'text/highlight', 'status/completed'];
async function buildKnightRiderScanner() {
  if (findComp('KnightRiderScanner')) return;
  const sec = newSection('KnightRiderScanner', 'components/sessions/KnightRiderScanner.tsx — a segment bar whose lit head sweeps back and forth. Compact: 7 segments 5×5, gap 2, padding 3×6. Banner: 11 segments 8×7, gap 3, padding 4×8. Track bg-card, hairline border, radius full. Segment colors cycle running → accent → waiting → highlight → completed; unlit 0.14, trail 2.6. Frozen here mid-sweep.');
  const comps = [];
  for (const [size, n, w, h, gap, pv, ph] of [['Compact', 7, 5, 5, 2, 3, 6], ['Banner', 11, 8, 7, 3, 4, 8]]) {
    const c = comp('Size=' + size, 'HORIZONTAL', { counterAxisAlignItems: 'CENTER', itemSpacing: gap, paddingTop: pv, paddingBottom: pv, paddingLeft: ph, paddingRight: ph, strokeWeight: 0.5 });
    rad(c, 'full'); c.fills = P('bg/card'); c.strokes = P('border');
    const head = Math.round(n * 0.6);
    for (let i = 0; i < n; i++) {
      const s = figma.createRectangle(); s.name = 'segment'; s.resize(w, h); s.cornerRadius = 1.5;
      const d = head - i;
      PA(s, 'fills', SCANNER_COLORS[i % SCANNER_COLORS.length], d < 0 ? 0.14 : Math.round(Math.max(0.14, 1 - d / 2.6) * 100) / 100);
      c.appendChild(s);
    }
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'KnightRiderScanner';
  finishSet(set, sec, 400, 'components/sessions/KnightRiderScanner.tsx. <KnightRiderScanner variant="compact|banner" />. Shown while a server header refreshes.');
}

async function buildInlineError() {
  if (findComp('InlineError')) return;
  const sec = newSection('InlineError', 'components/alerts/InlineError.tsx — margin 12×8, padding 12, gap 8, 1px dashed status.failed @45% border, radius md, bg-card. Header: WarningCircle fill 16 in status.failed + title 15/600. Message 13/18 secondary. Retry: min height 44, radius sm, status.failed fill, 13/600 onAccent. Details: same with a border and secondary label.');
  const c = comp('InlineError', 'VERTICAL', { strokeWeight: 1, dashPattern: [4, 3] });
  c.counterAxisSizingMode = 'FIXED'; c.resize(336, 100); c.primaryAxisSizingMode = 'AUTO';
  pad(c, 'md', 'md'); sp(c, 'itemSpacing', 'sm'); rad(c, 'md');
  c.fills = P('bg/card'); PA(c, 'strokes', 'status/failed', 0.45);
  const header = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER' }); sp(header, 'itemSpacing', 'sm'); fill(c, header);
  header.appendChild(icon('WarningCircle-fill', 16, 'status/failed'));
  const title = await T('Unreachable since 09:41', 'label/base', 'text/primary', { name: 'title' }); header.appendChild(title); title.layoutGrow = 1;
  wrapText(c, await T('The 6 sessions below were last loaded 12 min ago. Check the machine is awake and on the same network.', 'body/sm', 'text/secondary', { name: 'message', lineHeight: { unit: 'PIXELS', value: 18 } }));
  const actions = AL('HORIZONTAL', 'actions'); sp(actions, 'itemSpacing', 'sm'); fill(c, actions);
  for (const [label, primary] of [['Retry now', true], ['Details', false]]) {
    const b = AL('HORIZONTAL', primary ? 'retry' : 'details', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', minHeight: 44, strokeWeight: 1 });
    sp(b, 'paddingLeft', 'md'); sp(b, 'paddingRight', 'md'); rad(b, 'sm');
    if (primary) b.fills = P('status/failed'); else b.strokes = P('border');
    b.appendChild(await T(label, 'label/sm', primary ? 'text/onAccent' : 'text/secondary', { name: 'label' }));
    actions.appendChild(b);
  }
  const k = c.addComponentProperty('Title', 'TEXT', 'Unreachable since 09:41');
  title.componentPropertyReferences = { characters: k };
  c.description = 'components/alerts/InlineError.tsx. <InlineError title message onRetry retryLabel onDetails detailsLabel />. Used under a failed ServerHeaderRow.';
  sec.appendChild(c); c.x = 40; c.y = 120;
  sec.resizeWithoutConstraints(1000, c.y + c.height + 40);
}

async function buildServerHeaderRow() {
  if (findComp('ServerHeaderRow')) return;
  const sec = newSection('ServerHeaderRow', 'components/sessions/tree/ServerHeaderRow.tsx — padding 16 top / 4 bottom / 12 sides, gap 8. Rail 3×16 radius 2 in the server color; label 11/600 uppercase 0.6 tracking secondary; count 11 secondary. Refreshing adds a compact KnightRiderScanner. Collapsible: CaretDown bold 14 accent (open) / CaretRight secondary. Failed: Retry (11/700 uppercase, 0.8 tracking, status.failed, min height 44) and an InlineError below.');
  const comps = [];
  for (const state of ['Default', 'Refreshing', 'Failed']) {
    const c = comp('State=' + state, 'VERTICAL');
    c.fills = P('bg/primary');
    c.counterAxisSizingMode = 'FIXED'; c.resize(360, 40); c.primaryAxisSizingMode = 'AUTO';
    const row = AL('HORIZONTAL', 'row', { counterAxisAlignItems: 'CENTER' }); fill(c, row);
    sp(row, 'paddingTop', 'lg'); sp(row, 'paddingBottom', 'xs'); sp(row, 'paddingLeft', 'md'); sp(row, 'paddingRight', 'md'); sp(row, 'itemSpacing', 'sm');
    const rail = figma.createRectangle(); rail.name = 'rail'; rail.resize(3, 16); rail.cornerRadius = 2; rail.fills = hex(SERVER_PALETTE[0]); row.appendChild(rail);
    row.appendChild(upper(await T('mac-studio', 'label/xs', 'text/secondary', { name: 'label' }), 0.6));
    row.appendChild(await T('6', 'body/xs', 'text/secondary', { name: 'count' }));
    if (state === 'Refreshing') row.appendChild(inst('KnightRiderScanner', 'Size=Compact'));
    fill(row, spacer());
    if (state === 'Failed') {
      const r = AL('HORIZONTAL', 'retry', { counterAxisAlignItems: 'CENTER', minHeight: 44 });
      const t = upper(await T('Retry', 'label/xs', 'status/failed', { name: 'retry label' }), 0.8); t.fontName = { family: 'Inter', style: 'Bold' };
      r.appendChild(t); row.appendChild(r);
    } else {
      row.appendChild(icon('CaretDown', 14, 'text/accent'));
    }
    if (state === 'Failed') fill(c, inst('InlineError'));
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'ServerHeaderRow';
  const k = set.addComponentProperty('Server', 'TEXT', 'mac-studio');
  for (const c of set.children) c.findOne(n => n.type === 'TEXT' && n.name === 'label').componentPropertyReferences = { characters: k };
  finishSet(set, sec, 1240, 'components/sessions/tree/ServerHeaderRow.tsx. <ServerHeaderRow serverLabel serverColor totalCount refreshing failed collapsible collapsed onToggle onRetry onDetails />.');
}

async function buildSessionBanners() {
  if (findComp('SessionBanner')) return;
  const sec = newSection('SessionBanner', 'components/sessions/ConnectionBanner.tsx + ExternalSessionBanner.tsx — full-width strip under the session header: row gap 8, padding 8×16, bg-secondary, hairline bottom border. Title 13/600 in the accent, message 11/15 secondary. Reconnecting: spinner + text.warning. Stalled: CellSignalSlash 16 + text.secondary. External: Terminal 16 text.warning + a "Take over" button (4×12, radius 6, hairline warning border, 11/600 warning).');
  const comps = [];
  const kinds = [
    ['Reconnecting', 'CircleNotch', 'text/warning', 'Reconnecting…', 'Connection lost — the content below may be stale.'],
    ['Stalled', 'CellSignalSlash', 'text/secondary', 'Stream stalled', 'Connected, but no output has arrived for a while.'],
    ['External', 'Terminal', 'text/warning', 'Launched outside Threadbase', 'Streaming output only — prompts can\'t be answered from here.'],
  ];
  for (const [kind, ic, accent, title, msg] of kinds) {
    const c = rowComp('Kind=' + kind, 402, { strokeBottomWeight: 0.5, strokeTopWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 });
    pad(c, 'sm', 'lg'); sp(c, 'itemSpacing', 'sm'); c.fills = P('bg/secondary'); c.strokes = P('border');
    c.appendChild(icon(ic, 16, accent));
    const body = AL('VERTICAL', 'text', { itemSpacing: 1 }); c.appendChild(body); body.layoutGrow = 1;
    fill(body, await T(title, 'label/sm', accent, { name: 'title' }));
    wrapText(body, await T(msg, 'body/xs', 'text/secondary', { name: 'message', lineHeight: { unit: 'PIXELS', value: 15 } }));
    if (kind === 'External') {
      const b = AL('HORIZONTAL', 'take over', { strokeWeight: 0.5, cornerRadius: 6 }); pad(b, 'xs', 'md'); b.strokes = P('text/warning');
      b.appendChild(await T('Take over', 'label/xs', 'text/warning', { name: 'label' }));
      c.appendChild(b);
    }
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'SessionBanner';
  finishSet(set, sec, 900, 'Reconnecting/Stalled = components/sessions/ConnectionBanner.tsx <ConnectionBanner variant />. External = components/sessions/ExternalSessionBanner.tsx <ExternalSessionBanner onTakeOver />.');
}

async function buildServerStatusCard() {
  if (findComp('ServerStatusCard')) return;
  const sec = newSection('ServerStatusCard', 'components/sessions/banners/ServerUnsupportedBanner.tsx + ServerWarmingBanner.tsx — a Card (bg-card, radius md, padding 12, 1px border) with an 8px dot and a gap-2 body: title 13/600 primary, subtitle 11 secondary. Warming uses a status.waiting border and a pulsing LiveDot.');
  const comps = [];
  const kinds = [
    ['Unsupported', 'status/idle', 'border', 'Server needs an update', ['mac-studio runs a version that can\'t list projects. Update the Threadbase server to browse its history here.']],
    ['Warming', 'status/waiting', 'status/waiting', 'Server is warming up', ['mac-studio', 'History will appear when indexing finishes.']],
  ];
  for (const [kind, dotColor, border, title, subs] of kinds) {
    const c = comp('Kind=' + kind, 'HORIZONTAL', { strokeWeight: 1 });
    c.primaryAxisSizingMode = 'FIXED'; c.resize(360, 60); c.counterAxisSizingMode = 'AUTO';
    pad(c, 'md', 'md'); sp(c, 'itemSpacing', 'sm'); rad(c, 'md'); c.fills = P('bg/card'); c.strokes = P(border);
    const dwrap = AL('VERTICAL', 'dot slot', { paddingTop: 4 }); dwrap.appendChild(dot(8, dotColor)); c.appendChild(dwrap);
    const body = AL('VERTICAL', 'body', { itemSpacing: 2 }); c.appendChild(body); body.layoutGrow = 1;
    fill(body, await T(title, 'label/sm', 'text/primary', { name: 'title' }));
    for (const s of subs) wrapText(body, await T(s, 'body/xs', 'text/secondary', { name: 'subtitle' }));
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'ServerStatusCard';
  finishSet(set, sec, 820, 'Unsupported = <ServerUnsupportedBanner serverLabel />, Warming = <ServerWarmingBanner serverLabel />. Shown in the history list per server.');
}

async function buildConversationListItem() {
  if (findComp('ConversationListItem')) return;
  const sec = newSection('ConversationListItem', 'components/sessions/shared/ConversationListItem.tsx — row gap 8, padding 8×12, min height 64 (compact: 48, 6 vertical). 3px strip (radius 2, 4 vertical margin) in the server color. Leading: 28px avatar (radius 6, bg-card, 11/700 initials) or a 12-wide dot slot holding a 6px LiveDot. Body gap 2: title 13/600, MessagePreview, meta row (StateBadge + 11 secondary). Tail: time 11/500, ServerChip, ProviderMark; compact lays it out in a row.');
  const comps = [];
  for (const layout of ['Default', 'Compact']) {
    const compact = layout === 'Compact';
    const c = rowComp('Layout=' + layout, 402, { minHeight: compact ? 48 : 64, counterAxisAlignItems: compact ? 'CENTER' : 'MIN' });
    c.paddingTop = c.paddingBottom = compact ? 6 : 8; sp(c, 'paddingLeft', 'md'); sp(c, 'paddingRight', 'md'); sp(c, 'itemSpacing', 'sm');
    const strip = figma.createRectangle(); strip.name = 'strip'; strip.resize(3, compact ? 28 : 48); strip.cornerRadius = 2; strip.fills = hex(SERVER_PALETTE[0]);
    c.appendChild(strip); strip.layoutAlign = 'STRETCH';
    if (compact) {
      const slot = AL('HORIZONTAL', 'dot slot', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER' });
      slot.primaryAxisSizingMode = 'FIXED'; slot.resize(12, 12); slot.appendChild(dot(6, 'status/running')); c.appendChild(slot);
    } else {
      const av = AL('HORIZONTAL', 'avatar', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', cornerRadius: 6 });
      av.primaryAxisSizingMode = 'FIXED'; av.counterAxisSizingMode = 'FIXED'; av.resize(28, 28); av.fills = P('bg/card');
      const ini = await T('LA', 'label/xs', 'text/secondary', { name: 'initials' }); ini.fontName = { family: 'Inter', style: 'Bold' };
      av.appendChild(ini); c.appendChild(av);
    }
    const body = AL('VERTICAL', 'body', { itemSpacing: 2 }); c.appendChild(body); body.layoutGrow = 1;
    fill(body, await T('ledger-api · feat/idempotent-reconciliation', 'label/sm', 'text/primary', { name: 'title', textTruncation: 'ENDING', maxLines: 1, lineHeight: { unit: 'PIXELS', value: 18 } }));
    if (!compact) {
      fill(body, inst('MessagePreview', 'Kind=Plain'));
      const meta = AL('HORIZONTAL', 'meta', { counterAxisAlignItems: 'CENTER', itemSpacing: 6 }); fill(body, meta);
      meta.appendChild(inst('StateBadge'));
      meta.appendChild(await T('main · 12 msgs', 'body/xs', 'text/secondary', { name: 'meta' }));
    }
    const tail = AL(compact ? 'HORIZONTAL' : 'VERTICAL', 'tail', { counterAxisAlignItems: compact ? 'CENTER' : 'MAX', itemSpacing: compact ? 6 : 4 });
    const time = await T('2m', 'label/xs-medium', 'text/secondary', { name: 'time' });
    const parts = [time, inst('ServerChip'), inst('ProviderMark', 'Provider=Claude, Variant=Mono')];
    for (const p of compact ? parts.reverse() : parts) tail.appendChild(p);
    c.appendChild(tail);
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'ConversationListItem';
  const k = set.addComponentProperty('Title', 'TEXT', 'ledger-api · feat/idempotent-reconciliation');
  for (const c of set.children) c.findOne(n => n.type === 'TEXT' && n.name === 'title').componentPropertyReferences = { characters: k };
  finishSet(set, sec, 900, 'components/sessions/shared/ConversationListItem.tsx. Default = avatar row; Compact (leading="dot") is what ConvRow, SessionRow and DrillRow render.');
}

// ---------- batch 3: components/conversation ----------
const DARK = { bg: '#0d1117', card: '#21262d', border: '#30363d', text: '#e6edf3', secondary: '#858d97', running: '#3fb950', failed: '#f85149', header: '#1c2128', hunk: '#7d8590', icon: '#8b949e', added: '#0d4429', removed: '#4b1113' };
function corners(n, tl, tr, br, bl) { n.topLeftRadius = tl; n.topRightRadius = tr; n.bottomRightRadius = br; n.bottomLeftRadius = bl; }
function lh(px) { return { lineHeight: { unit: 'PIXELS', value: px } }; }
function colComp(name, width, props) {
  const c = comp(name, 'VERTICAL', props);
  c.counterAxisSizingMode = 'FIXED'; c.resize(width, 40); c.primaryAxisSizingMode = 'AUTO';
  return c;
}
function bar(name, w, h, fills, r) { const b = figma.createRectangle(); b.name = name; b.resize(w, h); b.cornerRadius = r; b.fills = fills; return b; }

async function buildMessageBubble() {
  if (findComp('MessageBubble')) return;
  const sec = newSection('MessageBubble', 'components/conversation/MessageBubble.tsx — row padding 12 horizontal, 4 vertical. Bubble max 85%, radius 16, padding 12, gap 4. User: text.accent fill, 6px bottom-end corner, body in onAccent. Assistant: bg-card + 1px border, 6px bottom-start corner. Body 15/22 plain text; only fenced code is parsed. Code block: bg-primary, radius 6, #1c2128 header ("Code" / "Copy"), mono 13 body. Tool tag: accent @12.5%, radius 6. Token count 11 secondary, right-aligned.');
  const comps = [];
  for (const role of ['User', 'Assistant', 'AssistantCode']) {
    const user = role === 'User';
    const c = comp('Role=' + role, 'HORIZONTAL', { primaryAxisAlignItems: user ? 'MAX' : 'MIN' });
    c.primaryAxisSizingMode = 'FIXED'; c.resize(402, 40); c.counterAxisSizingMode = 'AUTO';
    sp(c, 'paddingLeft', 'md'); sp(c, 'paddingRight', 'md'); sp(c, 'paddingTop', 'xs'); sp(c, 'paddingBottom', 'xs');
    c.fills = P('bg/primary');
    const b = AL('VERTICAL', 'bubble', { strokeWeight: 1 }); pad(b, 'md', 'md'); sp(b, 'itemSpacing', 'xs');
    b.counterAxisSizingMode = 'FIXED'; b.resize(user ? 250 : 321, 40); b.primaryAxisSizingMode = 'AUTO';
    if (user) { b.fills = P('text/accent'); corners(b, 16, 16, 6, 16); b.strokes = []; }
    else { b.fills = P('bg/card'); b.strokes = P('border'); corners(b, 16, 16, 16, 6); }
    c.appendChild(b);
    const body = user ? 'Can you make the reconciliation job idempotent?' : role === 'Assistant'
      ? 'Done. The job now keys each run on the statement date, so a retry skips rows it already posted.'
      : 'Add a unique index so a second insert is a no-op:';
    wrapText(b, await T(body, 'body/base', user ? 'text/onAccent' : 'text/primary', Object.assign({ name: 'body' }, lh(22))));
    if (role === 'AssistantCode') {
      const code = AL('VERTICAL', 'code block', { cornerRadius: 6, clipsContent: true }); code.fills = P('bg/primary'); fill(b, code);
      const head = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER', paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8 }); head.fills = hex(DARK.header); fill(code, head);
      head.appendChild(await T('Code', 'body/xs', 'text/secondary', { name: 'lang' })); fill(head, spacer());
      head.appendChild(await T('Copy', 'body/xs', 'text/accent', { name: 'copy' }));
      const cb = AL('VERTICAL', 'body', { paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8 }); cb.fills = hex('#282c34'); fill(code, cb);
      wrapText(cb, await T('CREATE UNIQUE INDEX ledger_run_day\n  ON ledger_runs (account_id, statement_date);', 'mono/sm', 'text/primary', { name: 'code' }));
      const tag = AL('HORIZONTAL', 'tool tag', { cornerRadius: 6, paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8 }); PA(tag, 'fills', 'text/accent', 0.125);
      const tool = await T('🔧 Bash', 'body/xs', 'text/accent', { name: 'tool' });
      // Inter has no emoji glyphs; the app renders the platform emoji font.
      await figma.loadFontAsync({ family: 'Noto Color Emoji', style: 'Regular' });
      tool.setRangeFontName(0, 2, { family: 'Noto Color Emoji', style: 'Regular' });
      tag.appendChild(tool); b.appendChild(tag);
    }
    if (!user) {
      const t = await T('1,234 tokens', 'body/xs', 'text/secondary', { name: 'tokens', textAlignHorizontal: 'RIGHT' });
      wrapText(b, t);
    }
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'MessageBubble';
  finishSet(set, sec, 900, 'components/conversation/MessageBubble.tsx. <MessageBubble message highlight activeMatch />. Search matches: active = text.highlight fill + onHighlight text, inactive = highlight @35%, radius 3.');
}

async function buildThinkingCard() {
  if (findComp('ThinkingCard')) return;
  const sec = newSection('ThinkingCard', 'components/conversation/ThinkingCard.tsx — radius 10, 1px border, bg-card, 4 vertical margin. Header 8×12: "Reasoning" 13/600 secondary + ▼/▲ 11 secondary. Body 12 sides / 8 bottom, 13/19.5 secondary; redacted = italic "Reasoning redacted".');
  const comps = [];
  for (const state of ['Collapsed', 'Expanded', 'Redacted']) {
    const c = colComp('State=' + state, 378, { strokeWeight: 1, cornerRadius: 10 }); c.fills = P('bg/card'); c.strokes = P('border');
    const head = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER' }); pad(head, 'sm', 'md'); fill(c, head);
    head.appendChild(await T('Reasoning', 'label/sm', 'text/secondary', { name: 'label' })); fill(head, spacer());
    head.appendChild(await T(state === 'Collapsed' ? '▼' : '▲', 'body/xs', 'text/secondary', { name: 'chevron' }));
    if (state !== 'Collapsed') {
      const body = AL('VERTICAL', 'body'); sp(body, 'paddingLeft', 'md'); sp(body, 'paddingRight', 'md'); sp(body, 'paddingBottom', 'sm'); fill(c, body);
      const t = await T(state === 'Redacted' ? 'Reasoning redacted' : 'The retry path re-posts rows because the run key is the job id. Keying on (account, statement date) makes a second run a no-op.', 'body/sm', 'text/secondary', Object.assign({ name: 'content' }, lh(19.5)));
      if (state === 'Redacted') t.fontName = { family: 'Inter', style: 'Italic' };
      wrapText(body, t);
    }
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'ThinkingCard';
  finishSet(set, sec, 1300, 'components/conversation/ThinkingCard.tsx. <ThinkingCard text redacted />. Tap the header to toggle.');
}

async function buildThinkingBubble() {
  if (findComp('ThinkingBubble')) return;
  const sec = newSection('ThinkingBubble', 'components/conversation/ThinkingBubble.tsx — wrapper 12 horizontal, 12 top / 4 bottom. Bubble bg-card, radius 16 (6 bottom-left), padding 12, max 85%, gap 4, no border. Terminal lines mono 11/16.5 secondary (last 60, max height 180). Phase row gap 8: phase label 11 secondary + compact KnightRiderScanner. Quiet adds two 11px border bars (72% / 54%, radius 6).');
  const comps = [];
  for (const kind of ['Scanner', 'Terminal', 'Quiet']) {
    const c = comp('Kind=' + kind, 'HORIZONTAL');
    c.primaryAxisSizingMode = 'FIXED'; c.resize(402, 40); c.counterAxisSizingMode = 'AUTO';
    sp(c, 'paddingLeft', 'md'); sp(c, 'paddingRight', 'md'); sp(c, 'paddingTop', 'md'); sp(c, 'paddingBottom', 'xs'); c.fills = P('bg/primary');
    const b = AL('VERTICAL', 'bubble'); pad(b, 'md', 'md'); sp(b, 'itemSpacing', 'xs'); b.fills = P('bg/card'); corners(b, 16, 16, 16, 6);
    c.appendChild(b);
    if (kind !== 'Scanner') {
      b.appendChild(await T('$ npm run typecheck\n> tsc --noEmit\nsrc/jobs/reconcile.ts: ok', 'mono/xs', 'text/secondary', Object.assign({ name: 'terminal' }, lh(16.5))));
    }
    const row = AL('HORIZONTAL', 'phase row', { counterAxisAlignItems: 'CENTER' }); sp(row, 'itemSpacing', 'sm'); b.appendChild(row);
    if (kind !== 'Quiet') row.appendChild(await T(kind === 'Scanner' ? 'Thinking' : 'Acting', 'body/xs', 'text/secondary', { name: 'phase' }));
    row.appendChild(inst('KnightRiderScanner', 'Size=Compact'));
    if (kind === 'Quiet') {
      const sk = AL('VERTICAL', 'skeleton', { itemSpacing: 4, paddingTop: 4 }); b.appendChild(sk);
      sk.appendChild(bar('bar', 140, 11, P('border'), 6)); sk.appendChild(bar('bar', 105, 11, P('border'), 6));
    }
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'ThinkingBubble';
  finishSet(set, sec, 900, 'components/conversation/ThinkingBubble.tsx. Shown while the agent works; swaps to a QuestionCard when a question arrives. Fades out over 350 ms.');
}

async function buildToolCard() {
  if (findComp('ToolCard')) return;
  const sec = newSection('ToolCard', 'components/conversation/ToolCard.tsx — bg-secondary, radius 6, 1px border (status.failed on error). Header gap 4, padding 8, min height 44: 13px Phosphor icon by tool (Terminal = Bash/exec, PencilSimple = Edit, Plug = MCP, Wrench = fallback…), name 13 secondary, summary mono 11 secondary (one line), "Error" 11/600 failed, ▼/▲. Body: 1px top border, padding 8, mono 11 primary (failed on error).');
  const comps = [];
  const kinds = [
    ['Collapsed', 'Terminal', 'exec_command', 'npm run typecheck', null],
    ['Expanded', 'Terminal', 'exec_command', 'npm run typecheck', '> threadbase-mobile@1.0.0 typecheck\n> tsc --noEmit'],
    ['Error', 'Terminal', 'exec_command', 'npm test', 'FAIL src/jobs/reconcile.test.ts\n  ● posts each row once'],
    ['NoContent', 'Plug', 'github · list_pull_requests', null, null],
  ];
  for (const [state, ic, name, summary, body] of kinds) {
    const err = state === 'Error';
    const c = colComp('State=' + state, 378, { strokeWeight: 1, cornerRadius: 6, clipsContent: true }); c.fills = P('bg/secondary'); c.strokes = P(err ? 'status/failed' : 'border');
    const head = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER', minHeight: 44 }); pad(head, 'sm', 'sm'); sp(head, 'itemSpacing', 'xs'); fill(c, head);
    head.appendChild(icon(ic, 13, 'text/secondary'));
    const nm = await T(name, 'body/sm', 'text/secondary', { name: 'name' }); head.appendChild(nm);
    if (summary) { const s = await T(summary, 'mono/xs', 'text/secondary', { name: 'summary', textTruncation: 'ENDING', maxLines: 1 }); head.appendChild(s); s.layoutGrow = 1; }
    else nm.layoutGrow = 1;
    if (err) head.appendChild(await T('Error', 'label/xs', 'status/failed', { name: 'error' }));
    if (state !== 'NoContent') head.appendChild(await T(body ? '▲' : '▼', 'body/xs', 'text/secondary', { name: 'chevron' }));
    if (body) {
      const bd = AL('VERTICAL', 'body', { strokeTopWeight: 1, strokeBottomWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 }); pad(bd, 'sm', 'sm'); bd.strokes = P('border'); fill(c, bd);
      wrapText(bd, await T(body, 'mono/xs', err ? 'status/failed' : 'text/primary', { name: 'result' }));
    }
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'ToolCard';
  finishSet(set, sec, 880, 'components/conversation/ToolCard.tsx. <ToolCard name input result isError />. Swap the icon instance per tool.');
}

async function buildDiffViewer() {
  if (findComp('DiffViewer')) return;
  const sec = newSection('DiffViewer', 'components/conversation/DiffViewer.tsx — always the dark palette (hard-coded), whatever the theme. Container #0d1117, radius 10, 1px #30363d. Header #1c2128, gap 4, padding 8: FileCode 14 #8b949e, filename mono 13, +N 13/600 green, −N 13/600 red, "Copy patch" 11. Hunk mono 11 #7d8590 on #1c2128. Lines mono 11: added #0d4429, removed #4b1113, 12-wide prefix. Over 100 lines collapses to "Show all N lines" (13 accent).');
  const comps = [];
  for (const state of ['Expanded', 'Collapsed']) {
    const c = colComp('State=' + state, 378, { strokeWeight: 1, cornerRadius: 10, clipsContent: true }); c.fills = hex(DARK.bg); c.strokes = hex(DARK.border);
    const head = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER', itemSpacing: 4, paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }); head.fills = hex(DARK.header); fill(c, head);
    head.appendChild(icon('FileCode', 14, hex(DARK.icon)));
    const fn = await T('src/jobs/reconcile.ts', 'mono/sm', hex(DARK.text), { name: 'filename', textTruncation: 'ENDING', maxLines: 1 }); head.appendChild(fn); fn.layoutGrow = 1;
    head.appendChild(await T(state === 'Collapsed' ? '+180' : '+2', 'label/sm', hex(DARK.running), { name: 'added' }));
    head.appendChild(await T(state === 'Collapsed' ? '−60' : '−1', 'label/sm', hex(DARK.failed), { name: 'removed' }));
    const cp = AL('HORIZONTAL', 'copy patch', { counterAxisAlignItems: 'CENTER', primaryAxisAlignItems: 'CENTER', minHeight: 44, paddingLeft: 8, paddingRight: 8 });
    cp.appendChild(await T('Copy patch', 'body/xs', hex(DARK.secondary), { name: 'label' })); head.appendChild(cp);
    if (state === 'Collapsed') {
      const more = AL('HORIZONTAL', 'show all', { primaryAxisAlignItems: 'CENTER' }); pad(more, 'md', 'md'); fill(c, more);
      more.appendChild(await T('Show all 240 lines', 'body/sm', 'text/accent', { name: 'label' }));
    } else {
      const hunk = AL('HORIZONTAL', 'hunk', { paddingTop: 2, paddingBottom: 2, paddingLeft: 8, paddingRight: 8 }); hunk.fills = hex(DARK.header); fill(c, hunk);
      hunk.appendChild(await T('@@ -10,6 +10,8 @@', 'mono/xs', hex(DARK.hunk), { name: 'hunk' }));
      const lines = [[' ', 'export async function reconcile(run: Run) {', null], ['-', '  const key = run.id', DARK.removed], ['+', '  const key = `${run.accountId}:${run.statementDate}`', DARK.added], ['+', '  if (await seen(key)) return', DARK.added], [' ', '  await post(run.rows)', null]];
      for (const [pre, text, bg] of lines) {
        const r = AL('HORIZONTAL', 'line', { paddingLeft: 4, paddingRight: 4 }); if (bg) r.fills = hex(bg); fill(c, r);
        const p = await T(pre, 'mono/xs', hex(DARK.secondary), { name: 'prefix' }); p.textAutoResize = 'HEIGHT'; p.resize(12, p.height); r.appendChild(p);
        r.appendChild(await T(text, 'mono/xs', hex(DARK.text), { name: 'content' }));
      }
    }
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'DiffViewer';
  finishSet(set, sec, 880, 'components/conversation/DiffViewer.tsx. <DiffViewer filename patch />. Scrolls horizontally; pinch-zoom 0.5×–2×.');
}

async function buildMessageSkeletonRow() {
  if (findComp('MessageSkeletonRow')) return;
  const sec = newSection('MessageSkeletonRow', 'components/conversation/MessageSkeletonRow.tsx — padding 8×12, bars 13 high, radius 6, border fill, 8 apart: 88% / 82% / 55–67%. Every third row has 2 lines. Pulses 0.35 ↔ 0.85.');
  const comps = [];
  for (const [lines, widths] of [['3', [0.88, 0.82, 0.55]], ['2', [0.88, 0.67]]]) {
    const c = colComp('Lines=' + lines, 402); pad(c, 'sm', 'md'); sp(c, 'itemSpacing', 'sm'); c.fills = P('bg/primary');
    for (const w of widths) { const b = bar('bar', Math.round(378 * w), 13, [], 6); PA(b, 'fills', 'border', 0.6); c.appendChild(b); }
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'MessageSkeletonRow';
  finishSet(set, sec, 900, 'components/conversation/MessageSkeletonRow.tsx. <MessageSkeletonRow index />. Shown at 0.6 (mid-pulse).');
}

async function buildInheritedHistoryDivider() {
  if (findComp('InheritedHistoryDivider')) return;
  const sec = newSection('InheritedHistoryDivider', 'components/conversation/InheritedHistoryDivider.tsx — row gap 8, padding 12: hairline border rule, label 12 secondary centered (max 2 lines), hairline rule.');
  const comps = [];
  for (const [kind, label] of [['ForkedTime', 'Forked into Threadbase · 2:14 PM'], ['Forked', 'Forked into Threadbase'], ['Unavailable', 'Earlier history from before this fork isn\'t available.']]) {
    const c = rowComp('Kind=' + kind, 402); pad(c, 'md', 'md'); sp(c, 'itemSpacing', 'sm');
    hrule(c, 'border');
    const t = await T(label, 'body/xs', 'text/secondary', { name: 'label', textAlignHorizontal: 'CENTER' }); t.fontSize = 12;
    if (kind === 'Unavailable') { t.textAutoResize = 'HEIGHT'; t.resize(200, t.height); }
    c.appendChild(t);
    hrule(c, 'border');
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'InheritedHistoryDivider';
  finishSet(set, sec, 900, 'components/conversation/InheritedHistoryDivider.tsx. <InheritedHistoryDivider forkedAt unavailable />. Separates history inherited from a CLI session.');
}

async function buildLivePauseControl() {
  if (findComp('LivePauseControl')) return;
  const sec = newSection('LivePauseControl', 'components/conversation/LivePauseControl.tsx — pill: gap 4, 1px border, radius full, padding 3×8. Live: everything status.running, LiveDot pulsing, Pause fill 13. Paused: text.secondary, Play fill 13.');
  const comps = [];
  for (const [state, color, ic] of [['Live', 'status/running', 'Pause-fill'], ['Paused', 'text/secondary', 'Play-fill']]) {
    const c = comp('State=' + state, 'HORIZONTAL', { counterAxisAlignItems: 'CENTER', itemSpacing: 4, strokeWeight: 1, paddingTop: 3, paddingBottom: 3 });
    sp(c, 'paddingLeft', 'sm'); sp(c, 'paddingRight', 'sm'); rad(c, 'full'); c.strokes = P(color); c.fills = P('bg/primary');
    c.appendChild(dot(7, color));
    c.appendChild(await T(state, 'label/xs', color, { name: 'label' }));
    c.appendChild(icon(ic, 13, color));
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'LivePauseControl';
  finishSet(set, sec, 400, 'components/conversation/LivePauseControl.tsx. <LivePauseControl paused onToggle />. Pauses live output updates.');
}

async function buildSlowLoadingBanner() {
  if (findComp('SlowLoadingBanner')) return;
  const sec = newSection('SlowLoadingBanner', 'components/conversation/SlowLoadingBanner.tsx — a Banner (centered over a 55% black scrim): 240 wide, gap 12, padding 16×24, radius 12, 1px text.warning border, bg-card. Spinner warning, title 15/600 (one of three), message 13/19 warning, full-width Cancel (text.danger border + label).');
  const c = colComp('SlowLoadingBanner', 240, { counterAxisAlignItems: 'CENTER', cornerRadius: 12, strokeWeight: 1 });
  pad(c, 'lg', 'xl'); sp(c, 'itemSpacing', 'md'); c.fills = P('bg/card'); c.strokes = P('text/warning');
  c.appendChild(icon('CircleNotch', 20, 'text/warning'));
  wrapText(c, await T('Untangling a long thread…', 'label/base', 'text/primary', { name: 'title', textAlignHorizontal: 'CENTER' }));
  wrapText(c, await T('Wasn\'t expecting them to be this heavy. We\'re loading as fast as we can.', 'body/sm', 'text/warning', Object.assign({ name: 'message', textAlignHorizontal: 'CENTER' }, lh(19))));
  const btn = AL('HORIZONTAL', 'cancel', { primaryAxisAlignItems: 'CENTER', cornerRadius: 8, strokeWeight: 1 }); pad(btn, 'xs', 'lg'); btn.fills = P('bg/secondary'); btn.strokes = P('text/danger'); fill(c, btn);
  btn.appendChild(await T('Cancel', 'label/sm', 'text/danger', { name: 'label' }));
  c.description = 'components/conversation/SlowLoadingBanner.tsx. <SlowLoadingBanner visible onCancel />. Titles rotate: "Untangling a long thread…", "Messages are fashionably late…", "Your messages hit some traffic…".';
  sec.appendChild(c); c.x = 40; c.y = 120;
  sec.resizeWithoutConstraints(1000, c.y + c.height + 40);
}

async function buildChatComposer() {
  if (findComp('ChatComposer')) return;
  const sec = newSection('ChatComposer', 'components/conversation/ChatComposer.tsx — column gap 8, padding 8, bg-primary, hairline top border. Chips (attachments, suggestion): gap 4, padding 4×8, bg-card, radius 16, 1px border, max 200. Input row gap 8, bottom-aligned: attach 52×44 (bg-card, radius 10, border, Paperclip 24), field (bg-card, radius 10, border, 15 text, padding 8, 44–160 high, ArrowsOut 20 on iOS), trailing 52×44 text.accent button with a 24 onAccent icon: PaperPlaneRight (content), Microphone (empty), MicrophoneSlash (dictating). Disabled = 40%.');
  const comps = [];
  for (const state of ['Empty', 'Typing', 'Dictating', 'Attachments']) {
    const c = colComp('State=' + state, 402, { strokeTopWeight: 0.5, strokeBottomWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 });
    pad(c, 'sm', 'sm'); sp(c, 'itemSpacing', 'sm'); c.fills = P('bg/primary'); c.strokes = P('border');
    if (state === 'Attachments') {
      const chips = AL('HORIZONTAL', 'chips', { itemSpacing: 4, paddingTop: 4, paddingBottom: 4 }); fill(c, chips);
      for (const [ic, label, x] of [['Image', 'screenshot-0922.png', true], ['Sparkle', 'Run the tests again', false]]) {
        const chip = AL('HORIZONTAL', x ? 'attachment' : 'suggestion', { counterAxisAlignItems: 'CENTER', itemSpacing: 4, strokeWeight: 1, cornerRadius: 16, maxWidth: 200 });
        pad(chip, 'xs', 'sm'); chip.fills = P('bg/card'); chip.strokes = P('border');
        chip.appendChild(icon(ic, 14, x ? 'text/primary' : 'text/accent'));
        chip.appendChild(await T(label, x ? 'body/xs' : 'body/sm', x ? 'text/primary' : 'text/secondary', { name: 'label' }));
        if (x) chip.appendChild(icon('X', 14, 'text/secondary'));
        chips.appendChild(chip);
      }
    }
    const row = AL('HORIZONTAL', 'input row', { counterAxisAlignItems: 'MAX' }); sp(row, 'itemSpacing', 'sm'); fill(c, row);
    const box = (name, fills, strokes) => {
      const b = AL('HORIZONTAL', name, { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', cornerRadius: 10, strokeWeight: 1 });
      b.primaryAxisSizingMode = 'FIXED'; b.counterAxisSizingMode = 'FIXED'; b.resize(52, 44); b.fills = fills; b.strokes = strokes; return b;
    };
    const attach = box('attach', P('bg/card'), P('border')); attach.appendChild(icon('Paperclip', 24, 'text/primary')); row.appendChild(attach);
    const field = AL('HORIZONTAL', 'field', { counterAxisAlignItems: 'MAX', cornerRadius: 10, strokeWeight: 1, minHeight: 44 }); pad(field, 'sm', 'sm'); field.fills = P('bg/card'); field.strokes = P('border');
    row.appendChild(field); field.layoutGrow = 1;
    const typed = state === 'Typing' ? 'Also add a test that runs the job twice and checks the ledger balance.' : state === 'Dictating' ? 'Also add a test that runs' : null;
    const t = await T(typed || 'Send a message…', 'body/base', typed ? 'text/primary' : 'text/secondary', { name: typed ? 'text' : 'placeholder' });
    field.appendChild(t); t.layoutGrow = 1; t.textAutoResize = 'HEIGHT';
    field.appendChild(icon('ArrowsOut', 20, 'text/secondary'));
    const send = box('send', P('text/accent'), []);
    const ic = state === 'Empty' ? 'Microphone' : state === 'Dictating' ? 'MicrophoneSlash' : 'PaperPlaneRight';
    send.appendChild(icon(ic, 24, 'text/onAccent')); row.appendChild(send);
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'ChatComposer';
  finishSet(set, sec, 880, 'components/conversation/ChatComposer.tsx. <ChatComposer onSend disabled attachments suggestion />. Placeholder "Starting session…" while disabled (whole composer at 40%). Expand opens a full-screen editor.');
}

// ---------- batch 5: alerts, shared, quick-access, shelf, pair, misc ----------
const LEVEL = { Info: ['Info', 'text/secondary'], Warning: ['Warning', 'status/waiting'], Error: ['WarningCircle-fill', 'status/failed'] };
function styled(t, style, size) { if (style) t.fontName = { family: 'Inter', style: style }; if (size) t.fontSize = size; return t; }
// Outlined or filled button; fills/strokes are [name, opacity] token pairs or null.
async function button(name, label, textStyle, textColor, opts) {
  const o = opts || {};
  const b = AL('HORIZONTAL', name, { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', minHeight: o.minHeight === undefined ? 44 : o.minHeight, strokeWeight: o.strokeWeight || 1, cornerRadius: o.radius === undefined ? 6 : o.radius, itemSpacing: 4 });
  b.paddingLeft = b.paddingRight = o.ph === undefined ? 12 : o.ph; b.paddingTop = b.paddingBottom = o.pv || 0;
  if (o.fill) PA(b, 'fills', o.fill[0], o.fill[1]);
  if (o.stroke) PA(b, 'strokes', o.stroke[0], o.stroke[1]);
  const t = await T(label, textStyle, textColor, { name: 'label' });
  if (o.weight) t.fontName = { family: 'Inter', style: o.weight };
  if (o.size) t.fontSize = o.size;
  t.textAlignHorizontal = 'CENTER';
  b.appendChild(t);
  return b;
}
function iconBox(name, ic, size, color, w, h, radius) {
  const b = AL('HORIZONTAL', name, { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', cornerRadius: radius || 0 });
  b.primaryAxisSizingMode = 'FIXED'; b.counterAxisSizingMode = 'FIXED'; b.resize(w, h || w);
  b.appendChild(icon(ic, size, color));
  return b;
}
function switchNode(on) {
  const tr = AL('HORIZONTAL', 'switch', { counterAxisAlignItems: 'CENTER', primaryAxisAlignItems: on ? 'MAX' : 'MIN', paddingLeft: 2, paddingRight: 2 });
  tr.primaryAxisSizingMode = 'FIXED'; tr.counterAxisSizingMode = 'FIXED'; tr.resize(51, 31); rad(tr, 'full');
  tr.fills = on ? P('text/accent') : P('border');
  const th = figma.createEllipse(); th.name = 'thumb'; th.resize(27, 27); th.fills = hex('#ffffff'); tr.appendChild(th);
  return tr;
}
function glassShadow(n, a, blur, y) { n.effects = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: a }, offset: { x: 0, y: y }, radius: blur, spread: 0, visible: true, blendMode: 'NORMAL' }]; }
// Builders place content at y=120; a description longer than three lines runs into it, so push the content below the text.
function clearDesc(sec) {
  const desc = sec.children[1], rest = sec.children.slice(2);
  if (!desc || desc.type !== 'TEXT' || !rest.length) return;
  const delta = desc.y + desc.height + 24 - Math.min(...rest.map(n => n.y));
  if (delta <= 0) return;
  for (const n of rest) n.y += delta;
  sec.resizeWithoutConstraints(sec.width, sec.height + delta);
}
// Growing a section overlaps the one below, so restack them all afterwards.
function clearDescs(page) {
  const secs = (page || compPage).children.filter(n => n.type === 'SECTION').sort((a, b) => a.y - b.y);
  let y = secs.length ? secs[0].y : 0;
  for (const sec of secs) { clearDesc(sec); sec.y = y; y += sec.height + 80; }
}
function simpleSet(comps, sec, name, width, desc) { const set = figma.combineAsVariants(comps, sec); set.name = name; finishSet(set, sec, width, desc); return set; }
function single(c, sec, desc) { c.description = desc; sec.appendChild(c); c.x = 40; c.y = 120; sec.resizeWithoutConstraints(Math.max(1000, c.width + 80), c.y + c.height + 40); }

async function buildStatusPill() {
  if (findComp('StatusPill')) return;
  const sec = newSection('StatusPill', 'components/alerts/StatusPill.tsx — 32×32 button, radius 8, Bell 20 text.secondary; 8px dot top 4 / end 4: status.failed (error) or status.waiting (warning). HomeStatusPill idle shows GlobeSimple 20, no dot. Also ui/AvatarMenu: 32×32, Gear 22.');
  const comps = [];
  for (const [level, ic, color] of [['Error', 'Bell', 'status/failed'], ['Warning', 'Bell', 'status/waiting'], ['Idle', 'GlobeSimple', null]]) {
    const c = comp('Level=' + level, 'HORIZONTAL', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', cornerRadius: 8 });
    c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED'; c.resize(32, 32); c.fills = P('bg/primary');
    c.appendChild(icon(ic, 20, 'text/secondary'));
    if (color) { const d = dot(8, color); c.appendChild(d); d.layoutPositioning = 'ABSOLUTE'; d.x = 20; d.y = 4; }
    comps.push(c);
  }
  simpleSet(comps, sec, 'StatusPill', 400, 'components/alerts/StatusPill.tsx. Opens the StatusSheet. a11y: "Error. 3 issues", "Warning. Degraded", "Server Status".');
  const av = comp('AvatarMenu', 'HORIZONTAL', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', cornerRadius: 8 });
  av.primaryAxisSizingMode = 'FIXED'; av.counterAxisSizingMode = 'FIXED'; av.resize(32, 32); av.fills = P('bg/primary');
  av.appendChild(icon('Gear', 22, 'text/secondary')); av.description = 'components/ui/AvatarMenu.tsx. Opens Settings.';
  sec.appendChild(av); av.x = 480; av.y = 144;
}

async function buildStatusStrip() {
  if (findComp('StatusStrip')) return;
  const sec = newSection('StatusStrip', 'components/alerts/StatusStrip.tsx — shown 6 s for a new error: row gap 8, min height 44, padding 8×16, bg-secondary, hairline status.failed bottom border. WarningCircle fill 16 failed + title 15/500 primary, one line.');
  const c = rowComp('StatusStrip', 402, { minHeight: 44, strokeBottomWeight: 0.5, strokeTopWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 });
  pad(c, 'sm', 'lg'); sp(c, 'itemSpacing', 'sm'); c.fills = P('bg/secondary'); c.strokes = P('status/failed');
  c.appendChild(icon('WarningCircle-fill', 16, 'status/failed'));
  const t = await T('Can\'t reach Ronens-MacBook-Pro. Your sessions below are from 6 minutes ago.', 'title/base-medium', 'text/primary', { name: 'title', textTruncation: 'ENDING', maxLines: 1 });
  c.appendChild(t); t.layoutGrow = 1;
  single(c, sec, 'components/alerts/StatusStrip.tsx. Tap opens the StatusSheet.');
}

async function statusRow(name, level, title, message, actions, details) {
  const c = colComp(name, 354, { strokeWeight: 1 }); pad(c, 'md', 'md'); sp(c, 'itemSpacing', 'sm'); rad(c, 'md');
  c.fills = P('bg/primary'); if (level === 'Error') PA(c, 'strokes', 'status/failed', 0.4); else c.strokes = P('border');
  const head = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER' }); sp(head, 'itemSpacing', 'sm'); fill(c, head);
  head.appendChild(iconBox('dismiss', 'X', 18, 'text/secondary', 28));
  head.appendChild(icon(LEVEL[level][0], 16, LEVEL[level][1]));
  const t = await T(title, 'label/base', 'text/primary', { name: 'title' }); head.appendChild(t); t.layoutGrow = 1; t.textAutoResize = 'HEIGHT';
  wrapText(c, await T(message, 'body/sm', 'text/secondary', Object.assign({ name: 'message' }, lh(18))));
  if (actions.length) {
    const row = AL('HORIZONTAL', 'actions'); sp(row, 'itemSpacing', 'sm'); fill(c, row);
    for (const [label, primary] of actions) {
      row.appendChild(await button(label, label, 'label/sm', primary ? 'text/onAccent' : 'text/secondary', primary ? { fill: ['status/failed'], stroke: ['status/failed'] } : { stroke: ['border'] }));
    }
  }
  if (details) {
    const list = AL('VERTICAL', 'details'); sp(list, 'itemSpacing', 'sm'); fill(c, list);
    for (const [label, value] of details) {
      const r = AL('HORIZONTAL', 'detail', { counterAxisAlignItems: 'CENTER', minHeight: 44, cornerRadius: 6 }); sp(r, 'paddingLeft', 'sm'); r.fills = P('bg/secondary'); fill(list, r);
      const col = AL('VERTICAL', 'text', { itemSpacing: 2 }); r.appendChild(col); col.layoutGrow = 1;
      col.appendChild(upper(await T(label, 'body/xs', 'text/secondary', { name: 'label' }), 0));
      col.appendChild(styled(await T(value, 'mono/xs', 'text/primary', { name: 'value' }), null, 12));
      r.appendChild(iconBox('copy', 'Copy', 16, 'text/secondary', 44));
    }
  }
  return c;
}
async function buildStatusRow() {
  if (findComp('StatusRow')) return;
  const sec = newSection('StatusRow', 'components/alerts/StatusRow.tsx — card: 1px border (status.failed @40% on error), radius 10, bg-primary, padding 12, gap 8. Header gap 8: × 28 box (X 18), level icon 16 (info Info / warning Warning waiting / error WarningCircle fill failed), title 15/600. Message 13/18 secondary. Buttons min 44, 12 sides, radius 6, 1px border, 13/600 secondary; retryable Retry is filled status.failed with onAccent. Details: bg-secondary rows, 11 uppercase label + mono 12 value + Copy 16. Also the UI for CacheAlertBanner, HostPressureBanner and ServerStateMessage alerts.');
  const comps = [
    await statusRow('Kind=ErrorRetry', 'Error', 'Ronens-MacBook-Pro', 'Nothing has loaded from this server. Sessions below may be stale.', [['Retry', true], ['Technical details', false]]),
    await statusRow('Kind=Warning', 'Warning', 'Host under load', 'New sessions may be slow until something is closed on the computer.', []),
    await statusRow('Kind=Info', 'Info', 'Connecting to Work Mac…', 'Establishing a connection to the server.', []),
    await statusRow('Kind=Details', 'Error', 'Messages didn\'t load.', 'This could no longer be found', [['Technical details', false]], [['Error code', 'HTTP_503'], ['Raw error', 'connect ECONNREFUSED']]),
  ];
  simpleSet(comps, sec, 'StatusRow', 1540, 'components/alerts/StatusRow.tsx. <StatusRow alert onDismiss onRetry />. Swipe to dismiss.');
}

async function buildStatusSheet() {
  if (findComp('StatusSheet')) return;
  const sec = newSection('StatusSheet', 'components/alerts/StatusSheet.tsx — bottom sheet (50% / 85% snaps), bg-card, top radius 16. Content 16 sides / 24 bottom, gap 8: "Status" 17/600, summary 13 secondary, StatusRow per issue, outline buttons (min 44, border, radius 6, 13/600 accent), Close 13 secondary.');
  const c = colComp('StatusSheet', 402); corners(c, 16, 16, 0, 0); c.fills = P('bg/card');
  sp(c, 'paddingLeft', 'lg'); sp(c, 'paddingRight', 'lg'); sp(c, 'paddingBottom', 'xl'); c.paddingTop = 8; sp(c, 'itemSpacing', 'sm');
  const handle = AL('HORIZONTAL', 'handle wrap', { primaryAxisAlignItems: 'CENTER' }); fill(c, handle);
  handle.appendChild(bar('handle', 36, 4, P('border'), 2));
  c.appendChild(await T('Status', 'label/lg', 'text/primary', { name: 'title' }));
  c.appendChild(await T('2 errors · 1 warning', 'body/sm', 'text/secondary', { name: 'summary' }));
  fill(c, inst('StatusRow', 'Kind=ErrorRetry'));
  fill(c, inst('StatusRow', 'Kind=Warning'));
  for (const label of ['Retry everything', 'Server Status']) fill(c, await button(label, label, 'label/sm', 'text/accent', { stroke: ['border'] }));
  const close = await button('close', 'Close', 'body/sm', 'text/secondary', {}); fill(c, close);
  single(c, sec, 'components/alerts/StatusSheet.tsx. Opened from StatusPill / StatusStrip.');
}

async function buildCriticalDialog() {
  if (findComp('CriticalDialog')) return;
  const sec = newSection('CriticalDialog', 'components/alerts/CriticalDialog.tsx — centered over rgba(0,0,0,0.6), 24 side padding. Card bg-card, radius 16, 1px border, padding 24, gap 12. Header gap 8: level icon 20 + title 17/600. Message 13/20 secondary. Actions wrap, gap 8: min 44, min width 120, radius 10, 15/700 — primary accent/onAccent, secondary bordered/primary, destructive failed/onAccent. Busy: spinner + message.');
  const comps = [];
  const kinds = [
    ['TwoActions', 'Leave this session?', 'The agent keeps running on your computer until you stop it.', [['Cancel', 'secondary'], ['Confirm', 'primary']]],
    ['ThreeActions', 'Resume this conversation?', 'This conversation may still be open in a terminal on your computer. Resuming it here could interfere with that session.', [['Cancel', 'secondary'], ['Take over', 'destructive'], ['Resume anyway', 'primary']]],
    ['Busy', 'Your session has expired', 'Open Settings to pair this device again or update the API key.', null],
  ];
  for (const [kind, title, msg, actions] of kinds) {
    const c = colComp('Kind=' + kind, 354, { strokeWeight: 1, cornerRadius: 16 }); pad(c, 'xl', 'xl'); sp(c, 'itemSpacing', 'md'); c.fills = P('bg/card'); c.strokes = P('border');
    const head = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER' }); sp(head, 'itemSpacing', 'sm'); fill(c, head);
    head.appendChild(icon('WarningCircle-fill', 20, 'status/failed'));
    const t = await T(title, 'label/lg', 'text/primary', { name: 'title' }); head.appendChild(t); t.layoutGrow = 1;
    if (actions) {
      wrapText(c, await T(msg, 'body/sm', 'text/secondary', Object.assign({ name: 'message' }, lh(20))));
      const row = AL('HORIZONTAL', 'actions', { layoutWrap: 'WRAP', paddingTop: 4 }); sp(row, 'itemSpacing', 'sm'); sp(row, 'counterAxisSpacing', 'sm'); fill(c, row);
      for (const [label, kindB] of actions) {
        const o = { radius: 10, minWidth: 120, weight: 'Bold' };
        if (kindB === 'primary') o.fill = ['text/accent']; else if (kindB === 'destructive') o.fill = ['status/failed']; else o.stroke = ['border'];
        const b = await button(label, label, 'label/base', kindB === 'secondary' ? 'text/primary' : 'text/onAccent', o);
        b.minWidth = 120; row.appendChild(b); b.layoutGrow = 1;
      }
    } else {
      const busy = AL('HORIZONTAL', 'busy', { counterAxisAlignItems: 'CENTER' }); sp(busy, 'itemSpacing', 'sm'); fill(c, busy);
      busy.appendChild(icon('CircleNotch', 20, 'text/accent'));
      const m = await T('Opening Settings…', 'body/sm', 'text/secondary', { name: 'message' }); busy.appendChild(m);
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'CriticalDialog', 1240, 'components/alerts/CriticalDialog.tsx. <CriticalDialog level title message actions busy />. Scrim not included.');
}

async function buildNavigationLockOverlay() {
  if (findComp('NavigationLockOverlay')) return;
  const sec = newSection('NavigationLockOverlay', 'components/ui/NavigationLockOverlay.tsx — centered over rgba(13,17,23,0.55). Card bg-card, radius 16, padding 12×16, gap 8, shadow 0 6 12 @30%: accent spinner + "Opening…" 11 secondary.');
  const c = comp('NavigationLockOverlay', 'VERTICAL', { counterAxisAlignItems: 'CENTER', cornerRadius: 16 }); pad(c, 'md', 'lg'); sp(c, 'itemSpacing', 'sm');
  c.fills = P('bg/card'); glassShadow(c, 0.3, 12, 6);
  c.appendChild(icon('CircleNotch', 24, 'text/accent'));
  c.appendChild(await T('Opening…', 'body/xs', 'text/secondary', { name: 'label' }));
  single(c, sec, 'components/ui/NavigationLockOverlay.tsx. Blocks taps while a screen push is in flight. Card only.');
}

async function buildScreenHeader() {
  if (findComp('ScreenHeader')) return;
  const sec = newSection('ScreenHeader', 'components/shared/ScreenHeader.tsx — row, height 52, padding 8 sides, bg-primary, hairline bottom border. Left slot min 48: CaretLeft 28 primary. Title 15/600 centered (+ optional titleRight, gap 4). Right slot min 48. Also shared/HeaderOverflowMenu trigger: DotsThreeVertical 22 secondary.');
  const comps = [];
  for (const kind of ['Title', 'WithRight']) {
    const c = rowComp('Kind=' + kind, 402, { strokeBottomWeight: 0.5, strokeTopWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 });
    c.counterAxisSizingMode = 'FIXED'; c.resize(402, 52); sp(c, 'paddingLeft', 'sm'); sp(c, 'paddingRight', 'sm'); c.strokes = P('border');
    const left = iconBox('left', 'CaretLeft', 28, 'text/primary', 48, 44); c.appendChild(left);
    const mid = AL('HORIZONTAL', 'title row', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', itemSpacing: 4 }); c.appendChild(mid); mid.layoutGrow = 1;
    mid.appendChild(await T(kind === 'Title' ? 'Settings' : 'ledger-api', 'label/base', 'text/primary', { name: 'title' }));
    if (kind === 'WithRight') mid.appendChild(inst('ServerChip'));
    const right = kind === 'WithRight' ? iconBox('right', 'DotsThreeVertical', 22, 'text/secondary', 48, 44) : iconBox('right', 'X', 1, 'text/secondary', 48, 44);
    if (kind !== 'WithRight') right.children[0].visible = false;
    c.appendChild(right);
    comps.push(c);
  }
  simpleSet(comps, sec, 'ScreenHeader', 900, 'components/shared/ScreenHeader.tsx. <ScreenHeader title titleRight right onBack />.');
}

async function buildHeaderOverflowMenu() {
  if (findComp('HeaderOverflowMenu')) return;
  const sec = newSection('HeaderOverflowMenu', 'components/shared/HeaderOverflowMenu.tsx — over a rgba(0,0,0,0.15) backdrop, anchored 52 from the top and 8 from the end. Menu bg-secondary, radius 10, 1px border, min width 180, 4 vertical padding. Item gap 8, padding 8×12: icon 20 secondary + label 13 primary. Disabled = 40%.');
  const c = comp('HeaderOverflowMenu', 'VERTICAL', { strokeWeight: 1, cornerRadius: 10, minWidth: 180, paddingTop: 4, paddingBottom: 4 }); c.fills = P('bg/secondary'); c.strokes = P('border');
  for (const [ic, label, off] of [['PencilSimple', 'Rename'], ['ShareNetwork', 'Share'], ['Trash', 'Delete', true]]) {
    const r = AL('HORIZONTAL', 'item', { counterAxisAlignItems: 'CENTER' }); pad(r, 'sm', 'md'); sp(r, 'itemSpacing', 'sm'); fill(c, r);
    r.appendChild(icon(ic, 20, 'text/secondary')); r.appendChild(await T(label, 'body/sm', 'text/primary', { name: 'label' }));
    if (off) r.opacity = 0.4;
  }
  single(c, sec, 'components/shared/HeaderOverflowMenu.tsx. <HeaderOverflowMenu items />. Delete shown disabled. Items come from the caller.');
}

async function buildInfoModal() {
  if (findComp('InfoModal')) return;
  const sec = newSection('InfoModal', 'components/shared/InfoModal.tsx — bottom sheet over rgba(0,0,0,0.5): bg-secondary, top radius 16, 1px top border, max 70%. Header 12×16, bottom border: title 15/600 + X 22 secondary. Field rows 12×16, bottom border, gap 8: label 11 uppercase 0.5 tracking secondary, value mono 13 primary, Copy 16 (Check 16 success once copied).');
  const c = colComp('InfoModal', 402, { strokeTopWeight: 1, strokeBottomWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0, paddingBottom: 24 }); corners(c, 16, 16, 0, 0); c.fills = P('bg/secondary'); c.strokes = P('border');
  const line = { strokeBottomWeight: 1, strokeTopWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 };
  const head = AL('HORIZONTAL', 'header', Object.assign({ counterAxisAlignItems: 'CENTER' }, line)); pad(head, 'md', 'lg'); head.strokes = P('border'); fill(c, head);
  const t = await T('Session info', 'label/base', 'text/primary', { name: 'title' }); head.appendChild(t); t.layoutGrow = 1;
  head.appendChild(icon('X', 22, 'text/secondary'));
  for (const [label, value, copied] of [['Session ID', 'a1b2c3d4', true], ['Path', '/Users/ronen/dev/app', false]]) {
    const r = AL('HORIZONTAL', 'field', Object.assign({ counterAxisAlignItems: 'CENTER' }, line)); pad(r, 'md', 'lg'); sp(r, 'itemSpacing', 'sm'); r.strokes = P('border'); fill(c, r);
    const col = AL('VERTICAL', 'text', { itemSpacing: 2 }); r.appendChild(col); col.layoutGrow = 1;
    col.appendChild(upper(await T(label, 'body/xs', 'text/secondary', { name: 'label' }), 0.5));
    col.appendChild(await T(value, 'mono/sm', 'text/primary', { name: 'value' }));
    r.appendChild(icon(copied ? 'Check' : 'Copy', 16, copied ? 'text/success' : 'text/secondary'));
  }
  single(c, sec, 'components/shared/InfoModal.tsx. <InfoModal title fields headerAction />. The first field is shown in its copied state.');
}

const Q = { bg: '#0d1117', top: '#21262d', x: '#8b949e', head: '#58a6ff', text: '#e6edf3', radio: '#484f58', desc: '#6e7681', warn: '#d29922' };
async function buildQuestionCard() {
  if (findComp('QuestionCard')) return;
  const sec = newSection('QuestionCard', 'components/terminal/QuestionCard.tsx — hard-coded GitHub-dark literals, not theme tokens. #0d1117, 1px #21262d top, padding 8×12. Header 11/600 uppercase #58a6ff; detail mono 12/16 #8b949e; question 13/600 #e6edf3. Option: padding 8, radius 8, gap 10, 16px radio (1.5px #484f58; selected #58a6ff + 8px dot, row rgba(31,111,235,0.12)); label 13/18 #8b949e (selected #e6edf3/500); description 12/16 #6e7681. Cancel 13 #8b949e. Ghost = 55% with a note.');
  const comps = [];
  const kinds = [
    ['Structured', 'Fallback', null, 'Add fallback to ConversationCache?', [['both (Recommended)', 'indicator and discriminator'], ['indicator only'], ['discriminator only'], ['Nothing.']], -1, false],
    ['Permission', 'Bash command', 'git worktree add ../tb-mobile-worktrees/prune-loader\nThis command requires approval', 'Do you want to proceed?', [['Yes'], ['Yes, and don\'t ask again for: git worktree *'], ['No']], -1, true],
    ['Selected', 'Bash command', 'git worktree add ../tb-mobile-worktrees/prune-loader\nThis command requires approval', 'Do you want to proceed?', [['Yes'], ['Yes, and don\'t ask again for: git worktree *'], ['No']], 0, true],
    ['Ghost', 'Fallback', null, 'Add fallback to ConversationCache?', [['both (Recommended)', 'indicator and discriminator'], ['indicator only']], 0, false],
  ];
  for (const [kind, header, detail, question, options, sel, cancel] of kinds) {
    const c = colComp('Kind=' + kind, 402, { strokeTopWeight: 1, strokeBottomWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 }); pad(c, 'sm', 'md'); c.fills = hex(Q.bg); c.strokes = hex(Q.top);
    const h = upper(await T(header, 'label/xs', hex(Q.head), { name: 'header' }), 0.5); fill(c, h); h.paddingBottom = 4;
    const gap = n => { const s = spacer(); s.resize(1, n); fill(c, s); };
    gap(4);
    if (detail) { wrapText(c, styled(await T(detail, 'mono/xs', hex(Q.x), Object.assign({ name: 'detail' }, lh(16))), null, 12)); gap(8); }
    wrapText(c, await T(question, 'label/sm', hex(Q.text), Object.assign({ name: 'question' }, lh(18)))); gap(8);
    for (let i = 0; i < options.length; i++) {
      const [label, desc] = options[i]; const on = i === sel;
      const r = AL('HORIZONTAL', 'option', { itemSpacing: 10, cornerRadius: 8, paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }); fill(c, r);
      if (on) r.fills = [{ type: 'SOLID', color: { r: 31 / 255, g: 111 / 255, b: 235 / 255 }, opacity: 0.12 }];
      const radio = AL('HORIZONTAL', 'radio', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', strokeWeight: 1.5, cornerRadius: 8 });
      radio.primaryAxisSizingMode = 'FIXED'; radio.counterAxisSizingMode = 'FIXED'; radio.resize(16, 16); radio.strokes = hex(on ? Q.head : Q.radio);
      if (on) radio.appendChild(dot(8, hex(Q.head)));
      r.appendChild(radio);
      const col = AL('VERTICAL', 'text', { itemSpacing: 2 }); r.appendChild(col); col.layoutGrow = 1;
      const lt = await T(label, 'body/sm', hex(on ? Q.text : Q.x), Object.assign({ name: 'label' }, lh(18))); if (on) lt.fontName = { family: 'Inter', style: 'Medium' };
      wrapText(col, lt);
      if (desc) wrapText(col, styled(await T(desc, 'body/xs', hex(Q.desc), Object.assign({ name: 'description' }, lh(16))), null, 12));
      gap(4);
    }
    if (kind === 'Ghost') { wrapText(c, styled(await T('Answer sent — waiting for the agent to move on.', 'body/xs', hex(Q.x), { name: 'ghost note' }), null, 12)); c.opacity = 0.55; }
    if (cancel) {
      const cb = AL('HORIZONTAL', 'cancel', { primaryAxisAlignItems: 'CENTER', paddingTop: 8, paddingBottom: 8 }); fill(c, cb);
      cb.appendChild(await T('Cancel', 'body/sm', hex(Q.x), { name: 'label' }));
      const x = icon('X', 16, hex(Q.x)); c.appendChild(x); x.layoutPositioning = 'ABSOLUTE'; x.x = 402 - 12 - 20; x.y = 12;
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'QuestionCard', 900, 'components/terminal/QuestionCard.tsx. <QuestionCard question onAnswer onCancel ghost />. Unsupported prompts add a #d29922 note: "This prompt needs an answer this app can\'t send yet — answer it in the terminal."');
}

async function quickChip(name, kind) {
  const pinned = kind === 'Pinned', dir = kind === 'Directory';
  const c = comp(name, 'HORIZONTAL', { counterAxisAlignItems: 'CENTER', itemSpacing: 5, strokeWeight: 1, minHeight: 28, paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4 });
  rad(c, 'full');
  if (pinned) { c.strokes = P('text/accent'); c.fills = [{ type: 'SOLID', color: { r: 99 / 255, g: 179 / 255, b: 1 }, opacity: 0.1 }]; }
  else { c.strokes = [{ type: 'SOLID', color: { r: 99 / 255, g: 179 / 255, b: 1 }, opacity: 0.18 }]; c.fills = P('bg/card'); }
  const color = pinned ? 'text/accent' : 'text/secondary';
  c.appendChild(icon(dir ? 'Folder' : 'Lightning', 13, color));
  const t = dir ? styled(await T('~/dev/tb-mobile', 'mono/xs', color, { name: 'label' }), null, 10) : await T('Fix login redirect', 'body/xs', color, { name: 'label' });
  t.textTruncation = 'ENDING'; c.appendChild(t); t.maxWidth = 140;
  if (kind === 'Edit') {
    const b = AL('HORIZONTAL', 'delete', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', cornerRadius: 8 });
    b.primaryAxisSizingMode = 'FIXED'; b.counterAxisSizingMode = 'FIXED'; b.resize(16, 16); b.fills = hex('#ee5555');
    b.appendChild(icon('X-bold', 9, hex('#ffffff'))); c.appendChild(b); b.layoutPositioning = 'ABSOLUTE'; b.x = c.width - 10; b.y = -6;
  }
  return c;
}
async function buildQuickAccess() {
  if (findComp('QuickAccessChip')) return;
  const sec = newSection('QuickAccess', 'components/quick-access/ — Chip: gap 5, padding 4×10, min height 28, radius full, 1px rgba(99,179,255,0.18), bg-card; Folder/Lightning 13; label 11 secondary (dir = mono 10), max 140. Pinned: accent border + rgba(99,179,255,0.10), accent content. Edit: 16px #e55 delete badge. Strip: bg-secondary; Favorites tab (Star 13 + 15, accent/600 when expanded, 2px accent underline), GearSix + PencilSimple 16; chips wrap gap 7, padding 8, max 4 + "+ N more". Action sheet: bg-card, top radius 16, 15 labels, 18 icons.');
  const comps = [];
  for (const kind of ['Default', 'Pinned', 'Directory', 'Edit']) comps.push(await quickChip('Kind=' + kind, kind));
  simpleSet(comps, sec, 'QuickAccessChip', 700, 'components/quick-access/QuickAccessChip.tsx. <QuickAccessChip item pinned editing onPress onLongPress onDelete />.');

  const strips = [];
  for (const state of ['Expanded', 'Collapsed']) {
    const open = state === 'Expanded';
    const c = colComp('State=' + state, 402, { strokeBottomWeight: 1, strokeTopWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 }); c.fills = P('bg/secondary'); c.strokes = P('border');
    const bar2 = AL('HORIZONTAL', 'tab bar', { counterAxisAlignItems: 'CENTER', strokeBottomWeight: open ? 1 : 0, strokeTopWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 }); bar2.strokes = P('border'); fill(c, bar2);
    const tab = AL('HORIZONTAL', 'tab', { counterAxisAlignItems: 'CENTER', itemSpacing: 4, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8, strokeBottomWeight: 2, strokeTopWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 });
    tab.strokes = open ? P('text/accent') : []; bar2.appendChild(tab);
    tab.appendChild(icon('Star', 13, open ? 'text/accent' : 'text/secondary'));
    tab.appendChild(await T('Favorites', open ? 'label/base' : 'body/base', open ? 'text/accent' : 'text/secondary', { name: 'label' }));
    fill(bar2, spacer());
    if (open) {
      const tools = AL('HORIZONTAL', 'tools', { paddingRight: 8 }); bar2.appendChild(tools);
      for (const ic of ['GearSix', 'PencilSimple']) tools.appendChild(iconBox(ic, ic, 16, 'text/secondary', 28));
      const chips = AL('HORIZONTAL', 'chips', { layoutWrap: 'WRAP', itemSpacing: 7, counterAxisSpacing: 7 }); pad(chips, 'sm', 'sm'); fill(c, chips);
      for (const k of ['Pinned', 'Directory', 'Default', 'Default']) chips.appendChild(inst('QuickAccessChip', 'Kind=' + k));
      const more = await button('more', '+ 4 more', 'body/xs', 'text/secondary', { stroke: ['border'], radius: 20, minHeight: 0, ph: 11, pv: 6 });
      chips.appendChild(more);
    }
    strips.push(c);
  }
  const set = figma.combineAsVariants(strips, sec); set.name = 'QuickAccessStrip';
  finishSet(set, sec, 900, 'components/quick-access/QuickAccessStrip.tsx. Empty: "No favorites yet — long-press an item to pin it."');
  set.y = findComp('QuickAccessChip').y + findComp('QuickAccessChip').height + 40;

  const sheets = [];
  for (const item of ['Directory', 'Session']) {
    const c = colComp('Item=' + item, 402, { strokeTopWeight: 1, strokeBottomWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0, paddingBottom: 28 }); corners(c, 16, 16, 0, 0); c.fills = P('bg/card'); c.strokes = P('border');
    const title = AL('HORIZONTAL', 'title', { paddingTop: 10, paddingBottom: 10, strokeBottomWeight: 1, strokeTopWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 }); sp(title, 'paddingLeft', 'md'); sp(title, 'paddingRight', 'md'); title.strokes = P('border'); fill(c, title);
    title.appendChild(await T(item === 'Directory' ? '~/dev/tb-mobile' : 'Fix login redirect', 'body/sm', 'text/secondary', { name: 'label' }));
    const rows = item === 'Directory'
      ? [['ArrowRight', 'New Session here', 'text/accent'], ['FolderOpen', 'Browse directory', 'text/secondary', 'text/primary'], ['Star-fill', 'Unpin from Favorites', 'text/secondary', 'text/primary'], ['X', 'Cancel', 'status/failed']]
      : [['ArrowRight', 'Open session', 'text/accent'], ['Star', 'Pin to Favorites', 'text/secondary', 'text/primary'], ['X', 'Cancel', 'status/failed']];
    for (let i = 0; i < rows.length; i++) {
      const [ic, label, iconColor, textColor] = rows[i];
      const r = AL('HORIZONTAL', 'row', { counterAxisAlignItems: 'CENTER', paddingTop: 14, paddingBottom: 14, strokeBottomWeight: i < rows.length - 1 ? 1 : 0, strokeTopWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 });
      sp(r, 'paddingLeft', 'md'); sp(r, 'paddingRight', 'md'); sp(r, 'itemSpacing', 'sm'); r.strokes = P('bg/secondary'); fill(c, r);
      r.appendChild(icon(ic, 18, iconColor)); r.appendChild(await T(label, 'body/base', textColor || iconColor, { name: 'label' }));
    }
    sheets.push(c);
  }
  const s2 = figma.combineAsVariants(sheets, sec); s2.name = 'QuickAccessActionSheet';
  finishSet(s2, sec, 900, 'components/quick-access/QuickAccessActionSheet.tsx. Over a rgba(0,0,0,0.55) scrim. Directory shown pinned (Star fill, "Unpin").');
  s2.y = set.y + set.height + 40;
  sec.resizeWithoutConstraints(sec.width, s2.y + s2.height + 40);
}

async function buildShelf() {
  if (findComp('ShelfBubble')) return;
  const sec = newSection('Shelf', 'components/shelf/ — ShelfBubble: 52 circle, 12 from the edge ~35% down, glass (Android: bg-secondary @92%, text.accent @22% border), shadow 0 4 12 @22%, ChatsCircle fill 28 accent. Badge: min 20×20, radius 10, status.waiting with a 2px bg-primary ring, 11/700 bg-primary. ShelfPanel: max 480 × 70%, radius 16, glass (bg-secondary @95% + border on Android), header 17/600 + X 20, rows 12×16 gap 12: ProviderMark, 15 label, 13 server, 10px waiting dot.');
  const comps = [];
  for (const [kind, badge] of [['None', null], ['Count', '3'], ['Overflow', '99+']]) {
    const c = comp('Badge=' + kind, 'HORIZONTAL', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', strokeWeight: 1 });
    c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED'; c.resize(52, 52); rad(c, 'full');
    PA(c, 'fills', 'bg/secondary', 0.92); PA(c, 'strokes', 'text/accent', 0.22); glassShadow(c, 0.22, 12, 4);
    c.effects = c.effects.concat([{ type: 'BACKGROUND_BLUR', radius: 20, visible: true }]);
    c.appendChild(icon('ChatsCircle-fill', 28, 'text/accent'));
    if (badge) {
      const b = AL('HORIZONTAL', 'badge', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', minWidth: 20, cornerRadius: 10, strokeWeight: 2, paddingLeft: 5, paddingRight: 5, strokeAlign: 'OUTSIDE' });
      b.counterAxisSizingMode = 'FIXED'; b.resize(20, 20); b.primaryAxisSizingMode = 'AUTO'; b.fills = P('status/waiting'); b.strokes = P('bg/primary');
      b.effects = [{ type: 'DROP_SHADOW', color: { r: 0.82, g: 0.6, b: 0.13, a: 0.25 }, offset: { x: 0, y: 0 }, radius: 5, spread: 5, visible: true, blendMode: 'NORMAL' }];
      const t = await T(badge, 'label/xs', 'bg/primary', { name: 'count' }); t.fontName = { family: 'Inter', style: 'Bold' }; b.appendChild(t);
      c.appendChild(b); b.layoutPositioning = 'ABSOLUTE'; b.x = 52 - b.width + 4; b.y = -4;
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'ShelfBubble', 400, 'components/shelf/ShelfBubble.tsx. Draggable; snaps to the nearest side edge. a11y "Saved chats, 3 need you".');

  const p = colComp('ShelfPanel', 370, { strokeWeight: 1, cornerRadius: 16, clipsContent: true, paddingTop: 12, paddingBottom: 12 });
  PA(p, 'fills', 'bg/secondary', 0.95); p.strokes = P('border'); p.effects = [{ type: 'BACKGROUND_BLUR', radius: 30, visible: true }];
  const head = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER', paddingBottom: 8 }); sp(head, 'paddingLeft', 'lg'); sp(head, 'paddingRight', 'lg'); fill(p, head);
  const ht = await T('Saved chats', 'label/lg', 'text/primary', { name: 'title' }); head.appendChild(ht); ht.layoutGrow = 1;
  head.appendChild(icon('X', 20, 'text/secondary'));
  for (const [label, server, prov, needs] of [['Fix login redirect', 'MacBook', 'Claude', true], ['Release checklist', 'Build box', 'Codex', false], ['Refactor billing module', 'MacBook', 'Claude', false]]) {
    const r = AL('HORIZONTAL', 'row', { counterAxisAlignItems: 'CENTER' }); pad(r, 'md', 'lg'); sp(r, 'itemSpacing', 'md'); fill(p, r);
    r.appendChild(inst('ProviderMark', 'Provider=' + prov + ', Variant=Mono'));
    const col = AL('VERTICAL', 'text', { itemSpacing: 2 }); r.appendChild(col); col.layoutGrow = 1;
    col.appendChild(await T(label, 'body/base', 'text/primary', { name: 'label' }));
    col.appendChild(await T(server, 'body/sm', 'text/secondary', { name: 'server' }));
    if (needs) r.appendChild(dot(10, 'status/waiting'));
  }
  p.description = 'components/shelf/ShelfPanel.tsx. Over rgba(0,0,0,0.45), top = safe area + 24. Empty uses EmptyState "No saved chats yet" / "Long-press this bubble on a session or conversation to save it here."';
  sec.appendChild(p); p.x = 480; p.y = 120;
  sec.resizeWithoutConstraints(Math.max(sec.width, 900), Math.max(sec.height, p.y + p.height + 40));
}

async function buildSmallBanners() {
  if (findComp('FirstShowBanner')) return;
  const sec = newSection('Small banners', 'tour/FirstShowBanner (hard-coded blues: rgba(59,130,246,0.10) fill, 0.25 border, radius 8, text 12.5/18 #94aac7, "Got it" Menlo 11.5/600 #3b82f6), diagnostics/AnonymousDiagnosticsConsentBanner (a Card: Info 16 accent, title 13/600, description 11/16, "Learn more" 11/600 accent, switch), SweepBar (4px #79c0ff line with an 80% glow, grows over 2.5 s after 3 s). browse/BrowseSlowBanner is a Banner instance: "That\'s a heavy file tree…" / "Didn\'t think it\'d be this big. Give us just a moment." / Cancel (destructive), warning accent.');
  const fb = rowComp('FirstShowBanner', 378, { itemSpacing: 10, strokeWeight: 1, cornerRadius: 8, paddingTop: 9, paddingBottom: 9 });
  sp(fb, 'paddingLeft', 'md'); sp(fb, 'paddingRight', 'md');
  fb.fills = [{ type: 'SOLID', color: { r: 59 / 255, g: 130 / 255, b: 246 / 255 }, opacity: 0.1 }]; fb.strokes = [{ type: 'SOLID', color: { r: 59 / 255, g: 130 / 255, b: 246 / 255 }, opacity: 0.25 }];
  const ft = styled(await T('Tap a session to open its live terminal.', 'body/xs', hex('#94aac7'), Object.assign({ name: 'text' }, lh(18))), null, 12.5); fb.appendChild(ft); ft.layoutGrow = 1;
  const got = styled(await T('Got it', 'mono/xs', hex('#3b82f6'), { name: 'dismiss' }), null, 11.5); fb.appendChild(got);
  fb.description = 'components/tour/FirstShowBanner.tsx. <FirstShowBanner text onDismiss />. "Got it" is hard-coded, not in locales.';
  sec.appendChild(fb); fb.x = 40; fb.y = 120;

  const comps = [];
  for (const on of [false, true]) {
    const c = rowComp('Switch=' + (on ? 'On' : 'Off'), 378, { strokeWeight: 1, counterAxisAlignItems: 'CENTER' }); pad(c, 'md', 'md'); sp(c, 'itemSpacing', 'sm'); rad(c, 'md');
    c.fills = P('bg/card'); c.strokes = P('border');
    c.appendChild(icon('Info', 16, 'text/accent'));
    const col = AL('VERTICAL', 'body', { itemSpacing: 2 }); c.appendChild(col); col.layoutGrow = 1;
    fill(col, await T('Anonymous diagnostics', 'label/sm', 'text/primary', { name: 'title' }));
    wrapText(col, await T('Help improve Threadbase by sending crash reports and basic stability data not linked to your identity.', 'body/xs', 'text/secondary', Object.assign({ name: 'description' }, lh(16))));
    col.appendChild(await T('Learn more', 'label/xs', 'text/accent', { name: 'learn more' }));
    c.appendChild(switchNode(on));
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, sec); set.name = 'AnonymousDiagnosticsConsentBanner';
  set.description = 'components/diagnostics/AnonymousDiagnosticsConsentBanner.tsx. A Card with 12 side / 8 bottom margin.';
  set.layoutMode = 'HORIZONTAL'; set.itemSpacing = 24; set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 24; set.primaryAxisSizingMode = 'AUTO'; set.counterAxisSizingMode = 'AUTO';
  set.fills = []; set.strokes = hex('#9966ff'); set.dashPattern = [6, 4]; set.cornerRadius = 8; set.x = 40; set.y = fb.y + fb.height + 40;

  const sw = comp('SweepBar', 'HORIZONTAL'); sw.primaryAxisSizingMode = 'FIXED'; sw.counterAxisSizingMode = 'FIXED'; sw.resize(402, 4); sw.fills = hex('#79c0ff');
  sw.effects = [{ type: 'DROP_SHADOW', color: { r: 121 / 255, g: 192 / 255, b: 1, a: 0.8 }, offset: { x: 0, y: 2 }, radius: 16, spread: 0, visible: true, blendMode: 'NORMAL' }];
  sw.description = 'components/SweepBar.tsx. Absolute at safe-area top + 8; drawn at full width.';
  sec.appendChild(sw); sw.x = 40; sw.y = set.y + set.height + 40;
  sec.resizeWithoutConstraints(Math.max(1000, set.width + 80), sw.y + 60);
}

async function buildIdentityFingerprint() {
  if (findComp('IdentityFingerprintBlock')) return;
  const sec = newSection('IdentityFingerprintBlock', 'components/pair/IdentityFingerprintBlock.tsx + PairCameraIdentityCard.tsx — column gap 8: "Identity code" 13 secondary; code box mono 15/24 primary, bg-card, radius 10, border, padding 12. Deep-link: two columns (11/600 label + 13/18 body). Camera: 13/18 hint. "How to check" 13/500 accent + Caret 14, steps 13/18 secondary. Camera card: bg-secondary, radius 16, border, padding 12, gap 12, Done (min 44, accent border, radius 10, 15/700 accent).');
  const comps = [];
  for (const ctx of ['DeepLink', 'Camera']) {
    const c = colComp('Context=' + ctx, 354); sp(c, 'itemSpacing', 'sm'); c.fills = P('bg/secondary');
    c.appendChild(await T('Identity code', 'body/sm', 'text/secondary', { name: 'label' }));
    const box = AL('HORIZONTAL', 'code', { strokeWeight: 1 }); pad(box, 'md', 'md'); rad(box, 'md'); box.fills = P('bg/card'); box.strokes = P('border'); fill(c, box);
    const code = await T('K7QF-2M9X-HD4P-8TZN', 'mono/sm', 'text/primary', Object.assign({ name: 'value' }, lh(24))); code.fontSize = 15; box.appendChild(code);
    if (ctx === 'DeepLink') {
      const cols = AL('HORIZONTAL', 'columns'); sp(cols, 'itemSpacing', 'md'); fill(c, cols);
      for (const [label, body] of [['On this phone', 'The code above'], ['On that computer', 'Run tb-streamer identity — it must print this same code.']]) {
        const col = AL('VERTICAL', 'column', { itemSpacing: 4 }); cols.appendChild(col); col.layoutGrow = 1;
        fill(col, await T(label, 'label/xs', 'text/secondary', { name: 'label' }));
        wrapText(col, await T(body, 'body/sm', 'text/primary', Object.assign({ name: 'body' }, lh(18))));
      }
    } else {
      wrapText(c, await T('This should match the code shown under the QR on that computer.', 'body/sm', 'text/secondary', Object.assign({ name: 'hint' }, lh(18))));
    }
    const tog = AL('HORIZONTAL', 'how to check', { counterAxisAlignItems: 'CENTER', itemSpacing: 4, minHeight: 32 }); c.appendChild(tog);
    const tt = await T('How to check', 'label/sm', 'text/accent', { name: 'label' }); tt.fontName = { family: 'Inter', style: 'Medium' }; tog.appendChild(tt);
    tog.appendChild(icon(ctx === 'DeepLink' ? 'CaretUp' : 'CaretDown', 14, 'text/accent'));
    if (ctx === 'DeepLink') {
      const steps = AL('VERTICAL', 'steps', { itemSpacing: 4, paddingTop: 4 }); fill(c, steps);
      for (const s of ['1. On the computer you\'re pairing with, run tb-streamer identity.', '2. You should see the same grouped code as above.', '3. If it doesn\'t match, tap Cancel. This is not that computer.']) wrapText(steps, await T(s, 'body/sm', 'text/secondary', Object.assign({ name: 'step' }, lh(18))));
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'IdentityFingerprintBlock', 860, 'components/pair/IdentityFingerprintBlock.tsx. <IdentityFingerprintBlock fingerprint context="deeplink|camera|settings" />. Settings step 3: "If it doesn\'t match, this is not that computer. Forget it and pair again."');

  const card = colComp('PairCameraIdentityCard', 378, { strokeWeight: 1, cornerRadius: 16 }); pad(card, 'md', 'md'); sp(card, 'itemSpacing', 'md'); card.fills = P('bg/secondary'); card.strokes = P('border');
  fill(card, inst('IdentityFingerprintBlock', 'Context=Camera'));
  fill(card, await button('done', 'Done', 'label/base', 'text/accent', { fill: ['bg/card'], stroke: ['text/accent'], radius: 10, pv: 8, weight: 'Bold' }));
  card.description = 'components/pair/PairCameraIdentityCard.tsx. Bottom card over rgba(0,0,0,0.55) on the pairing camera.';
  const set = findComp('IdentityFingerprintBlock');
  sec.appendChild(card); card.x = 40; card.y = set.y + set.height + 40;
  sec.resizeWithoutConstraints(sec.width, card.y + card.height + 40);
}

// ---------- batch 4: components/servers ----------
const LINE_B = { strokeBottomWeight: 1, strokeTopWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 };
async function addServerButton(name) {
  const c = comp(name, 'HORIZONTAL', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', itemSpacing: 4, minHeight: 44, strokeWeight: 1 });
  pad(c, 'sm', 'md'); rad(c, 'md'); c.fills = P('bg/card'); c.strokes = P('border');
  c.appendChild(icon('Plus-bold', 14, 'text/accent'));
  const t = await T('Add Server', 'body/base', 'text/accent', { name: 'label' }); t.fontName = { family: 'Inter', style: 'Medium' }; c.appendChild(t);
  return c;
}
async function buildAddServerButton() {
  if (findComp('AddServerButton')) return;
  const sec = newSection('AddServerButton', 'components/servers/AddServerButton.tsx — row, gap 4, padding 10×12, min 44, radius 10, 1px border, bg-card: Plus bold 14 accent + "Add Server" 15/500 accent. Full width in its list.');
  const c = await addServerButton('AddServerButton'); c.primaryAxisSizingMode = 'FIXED'; c.resize(370, c.height);
  single(c, sec, 'components/servers/AddServerButton.tsx. <AddServerButton onPress />.');
}

async function buildEncryptionRefusalBanner() {
  if (findComp('EncryptionRefusalBanner')) return;
  const sec = newSection('EncryptionRefusalBanner', 'components/servers/EncryptionRefusalBanner.tsx — bg-secondary strip, padding 10 top / 12 bottom / 16 sides, gap 8. LockKeyOpen fill 16 danger + title 15/600 danger; body 11/16 secondary; buttons min 32, 11/600, hairline border: Retry (primary), Forget and re-pair (danger).');
  const c = colComp('EncryptionRefusalBanner', 402, { paddingTop: 10, paddingBottom: 12, itemSpacing: 8 }); sp(c, 'paddingLeft', 'lg'); sp(c, 'paddingRight', 'lg'); c.fills = P('bg/secondary');
  const head = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER', itemSpacing: 8 }); fill(c, head);
  head.appendChild(icon('LockKeyOpen-fill', 16, 'text/danger'));
  head.appendChild(await T('Not connecting to Work Mac', 'label/base', 'text/danger', { name: 'title' }));
  wrapText(c, await T('You require encryption for this server and it is not offering any, so nothing has been sent to it.', 'body/xs', 'text/secondary', Object.assign({ name: 'body' }, lh(16))));
  const row = AL('HORIZONTAL', 'actions', { itemSpacing: 8 }); c.appendChild(row);
  row.appendChild(await button('Retry', 'Retry', 'label/xs', 'text/primary', { stroke: ['border'], strokeWeight: 0.5, minHeight: 32 }));
  row.appendChild(await button('Forget', 'Forget and re-pair', 'label/xs', 'text/danger', { stroke: ['border'], strokeWeight: 0.5, minHeight: 32 }));
  single(c, sec, 'components/servers/EncryptionRefusalBanner.tsx. Shown on a pinned server that refused E2EE; never falls back to plaintext.');
}

async function buildFilterPresets() {
  if (findComp('FilterPresets')) return;
  const sec = newSection('FilterPresets', 'components/servers/FilterPresets.tsx — two presets in a row, each height 44, padding 16, radius 10, gap 7. "Only what needs me": 8px waiting dot + 14/600 waiting; off = status.waiting @50% border, on = status.waiting @16% fill + waiting border. "Everything": off = border + secondary label; on = accent border, bg-primary, primary label.');
  const comps = [];
  for (const preset of ['NeedsMe', 'Everything']) for (const on of [false, true]) {
    const c = comp('Preset=' + preset + ', State=' + (on ? 'On' : 'Off'), 'HORIZONTAL', { counterAxisAlignItems: 'CENTER', primaryAxisAlignItems: 'CENTER', itemSpacing: 7, strokeWeight: 1, cornerRadius: 10 });
    c.counterAxisSizingMode = 'FIXED'; c.resize(c.width, 44); c.primaryAxisSizingMode = 'AUTO'; sp(c, 'paddingLeft', 'lg'); sp(c, 'paddingRight', 'lg');
    if (preset === 'NeedsMe') {
      if (on) { PA(c, 'fills', 'status/waiting', 0.16); c.strokes = P('status/waiting'); } else PA(c, 'strokes', 'status/waiting', 0.5);
      c.appendChild(dot(8, 'status/waiting'));
      c.appendChild(styled(await T('Only what needs me', 'label/sm', 'status/waiting', { name: 'label' }), null, 14));
    } else {
      if (on) { c.strokes = P('text/accent'); c.fills = P('bg/primary'); } else c.strokes = P('border');
      c.appendChild(styled(await T('Everything', 'label/sm', on ? 'text/primary' : 'text/secondary', { name: 'label' }), null, 14));
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'FilterPresets', 700, 'components/servers/FilterPresets.tsx. <FilterPresets value onChange />. Shown at the top of FilterSortSheet.');
}

async function buildNoServersWelcome() {
  if (findComp('NoServersWelcome')) return;
  const sec = newSection('NoServersWelcome', 'components/servers/NoServersWelcome.tsx — card bg-card, radius 16, padding 24, gap 12, centered. 64 tile (radius 10, bg-secondary) with PlugsConnected light 32 accent; title 17/700 -0.3; description 15/20 secondary; underlined repo link 13 accent; accent Add Server button with ArrowRight bold 16 onAccent.');
  const c = colComp('NoServersWelcome', 354, { counterAxisAlignItems: 'CENTER', cornerRadius: 16 }); pad(c, 'xl', 'xl'); sp(c, 'itemSpacing', 'md'); c.fills = P('bg/card');
  const tile = iconBox('tile', 'PlugsConnected-light', 32, 'text/accent', 64, 64, 10); tile.fills = P('bg/secondary'); c.appendChild(tile);
  const title = await T('Connect your first server', 'label/lg', 'text/primary', { name: 'title', letterSpacing: { unit: 'PIXELS', value: -0.3 } }); title.fontName = { family: 'Inter', style: 'Bold' }; c.appendChild(title);
  const d = await T('Threadbase connects to a running tb-streamer instance. Add your server URL and API key to connect to your server.', 'body/base', 'text/secondary', Object.assign({ name: 'description', textAlignHorizontal: 'CENTER' }, lh(20))); wrapText(c, d);
  c.appendChild(await T('github.com/RonenMars/threadbase-streamer', 'body/sm', 'text/accent', { name: 'link', textDecoration: 'UNDERLINE' }));
  const b = await button('Add Server', 'Add Server', 'label/base', 'text/onAccent', { fill: ['text/accent'], radius: 10, ph: 24 }); b.itemSpacing = 8;
  b.appendChild(icon('ArrowRight-bold', 16, 'text/onAccent')); fill(c, b);
  single(c, sec, 'components/servers/NoServersWelcome.tsx. Empty state of the Servers screen.');
}

const BADGE_COLORS = ['#58a6ff', '#3fb950', '#d29922', '#f778ba', '#bc8cff', '#79c0ff'];
async function buildServerBadge() {
  if (findComp('ServerBadge')) return;
  const sec = newSection('ServerBadge', 'components/servers/ServerBadge.tsx — pill, gap 4, padding 2×8, color @12.5% fill, 6px dot + 11/500 label in the color. The color is picked from six fixed hues by server index; they are literals, not theme tokens.');
  const comps = [];
  for (let i = 0; i < BADGE_COLORS.length; i++) {
    const h = BADGE_COLORS[i];
    const c = comp('Color=' + (i + 1), 'HORIZONTAL', { counterAxisAlignItems: 'CENTER', itemSpacing: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2 }); rad(c, 'full'); c.fills = hex(h, 0.125);
    c.appendChild(dot(6, hex(h)));
    const t = await T('Work Mac', 'body/xs', hex(h), { name: 'label' }); t.fontName = { family: 'Inter', style: 'Medium' }; c.appendChild(t);
    comps.push(c);
  }
  simpleSet(comps, sec, 'ServerBadge', 700, 'components/servers/ServerBadge.tsx. <ServerBadge name colorIndex />. Colors: ' + BADGE_COLORS.join(' ') + '.');
}

async function buildServerIndexingBanner() {
  if (findComp('ServerIndexingBanner')) return;
  const sec = newSection('ServerIndexingBanner', 'components/servers/ServerIndexingBanner.tsx — card, padding 24, gap 12, centered: five 6px accent dots (gap 8, pulsing), title 15/600, subtitle 11/16 secondary; per server: name 13/600, count 11 secondary, 3px border track with accent fill (indeterminate: a 72px #58a6ff beam sweeping).');
  const comps = [];
  for (const kind of ['Indeterminate', 'Determinate']) {
    const c = colComp('Progress=' + kind, 354, { counterAxisAlignItems: 'CENTER' }); pad(c, 'xl', 'xl'); sp(c, 'itemSpacing', 'md'); rad(c, 'lg'); c.fills = P('bg/card');
    const dots = AL('HORIZONTAL', 'dots', { itemSpacing: 8 }); c.appendChild(dots);
    for (let i = 0; i < 5; i++) dots.appendChild(dot(6, 'text/accent', [0.3, 0.55, 1, 0.55, 0.3][i]));
    c.appendChild(await T('Scanning and indexing conversations…', 'label/base', 'text/primary', { name: 'title' }));
    wrapText(c, await T('Your server is warming up and building its conversation index for the first time. This only happens once — history will appear as soon as it\'s ready.', 'body/xs', 'text/secondary', Object.assign({ name: 'subtitle', textAlignHorizontal: 'CENTER' }, lh(16))));
    const srv = AL('VERTICAL', 'server', { itemSpacing: 6 }); fill(c, srv);
    const top = AL('HORIZONTAL', 'top', { counterAxisAlignItems: 'CENTER' }); fill(srv, top);
    const nm = await T('Work Mac', 'label/sm', 'text/primary', { name: 'name' }); top.appendChild(nm); nm.layoutGrow = 1;
    if (kind === 'Determinate') top.appendChild(await T('1,204 / 5,880 files', 'body/xs', 'text/secondary', { name: 'count' }));
    const track = AL('HORIZONTAL', 'track', { cornerRadius: 2, clipsContent: true, paddingLeft: kind === 'Indeterminate' ? 90 : 0 }); track.counterAxisSizingMode = 'FIXED'; fill(srv, track); track.resize(track.width, 3); track.fills = P('border');
    const b = kind === 'Indeterminate' ? bar('beam', 72, 3, hex('#58a6ff'), 2) : bar('fill', Math.round(306 * 1204 / 5880), 3, P('text/accent'), 2);
    track.appendChild(b);
    comps.push(c);
  }
  simpleSet(comps, sec, 'ServerIndexingBanner', 860, 'components/servers/ServerIndexingBanner.tsx. Shown while a server builds its first index.');
}

async function buildServerFormFields() {
  if (findComp('ServerFormFields')) return;
  const sec = newSection('ServerFormFields', 'components/servers/ServerFormFields.tsx — field titles 15/500 secondary (ClipboardText 18 accent paste action); inputs bg-primary, radius 10, 1px border, 15 primary, padding 8×12, min 44. URL row: protocol button "https://" + CaretDown bold 10. API key: Eye 18 toggle.');
  const c = colComp('ServerFormFields', 370); sp(c, 'itemSpacing', 'lg'); c.fills = P('bg/secondary'); pad(c, 'lg', 'lg');
  const field = async (title, placeholder, opts) => {
    const f = AL('VERTICAL', 'field', { itemSpacing: 8 }); fill(c, f);
    const h = AL('HORIZONTAL', 'title row', { counterAxisAlignItems: 'CENTER' }); fill(f, h);
    const tt = await T(title, 'body/base', 'text/secondary', { name: 'title' }); tt.fontName = { family: 'Inter', style: 'Medium' }; h.appendChild(tt); tt.layoutGrow = 1;
    if (opts.paste) h.appendChild(icon('ClipboardText', 18, 'text/accent'));
    const row = AL('HORIZONTAL', 'input row', { itemSpacing: 8 }); fill(f, row);
    if (opts.protocol) {
      const p = AL('HORIZONTAL', 'protocol', { counterAxisAlignItems: 'CENTER', itemSpacing: 4, minHeight: 44, strokeWeight: 1, cornerRadius: 10 }); pad(p, 'sm', 'md'); p.fills = P('bg/primary'); p.strokes = P('border');
      p.appendChild(await T('https://', 'body/base', 'text/primary', { name: 'label' })); p.appendChild(icon('CaretDown-bold', 10, 'text/secondary')); row.appendChild(p);
    }
    const inp = AL('HORIZONTAL', 'input', { counterAxisAlignItems: 'CENTER', minHeight: 44, strokeWeight: 1, cornerRadius: 10 }); pad(inp, 'sm', 'md'); inp.fills = P('bg/primary'); inp.strokes = P('border'); row.appendChild(inp); inp.layoutGrow = 1;
    const v = await T(placeholder, 'body/base', opts.value ? 'text/primary' : 'text/secondary', { name: 'value' }); inp.appendChild(v); v.layoutGrow = 1;
    if (opts.eye) inp.appendChild(icon('Eye', 18, 'text/secondary'));
  };
  await field('Label (optional)', 'e.g. Work Mac, Home Server', {});
  await field('Server URL', '192.168.1.10:8766', { protocol: true, paste: true, value: true });
  await field('API Key', 'Paste your API token here', { paste: true, eye: true });
  single(c, sec, 'components/servers/ServerFormFields.tsx. Shared by the add and edit server screens. Shown on bg-secondary for contrast.');
}

async function buildServerErrorModal() {
  if (findComp('ServerErrorModal')) return;
  const sec = newSection('ServerErrorModal', 'components/servers/ServerErrorModal.tsx — card bg-card, radius 16. Header padding 12, bottom border: 8px dot (running / failed) + name 15/600 + X 20. Detail rows 8×12: 64-wide label 15 secondary + value 15 primary (API key mono 11). Error box #F85149 @8% fill, @25% border, radius 6: XCircle fill 14 + 11/18 danger. Footer Close 15/500 accent.');
  const comps = [];
  for (const state of ['Failed', 'Connected']) {
    const failed = state === 'Failed';
    const c = colComp('State=' + state, 354, { cornerRadius: 16, clipsContent: true }); c.fills = P('bg/card');
    const head = AL('HORIZONTAL', 'header', Object.assign({ counterAxisAlignItems: 'CENTER', itemSpacing: 8 }, LINE_B)); pad(head, 'md', 'md'); head.strokes = P('border'); fill(c, head);
    head.appendChild(dot(8, failed ? 'status/failed' : 'status/running'));
    const nm = await T('Work Mac', 'label/base', 'text/primary', { name: 'name' }); head.appendChild(nm); nm.layoutGrow = 1;
    head.appendChild(icon('X', 20, 'text/secondary'));
    const body = AL('VERTICAL', 'details', { paddingTop: 8, paddingBottom: 8 }); fill(c, body);
    for (const [k, v, mono] of [['URL', 'http://192.168.1.10:8766'], ['API Key', '••••••••a9f2', true], ['Machine', 'ronen-mbp'], ['Platform', 'darwin'], ['Version', 'v2.4.1']]) {
      const r = AL('HORIZONTAL', 'row', { counterAxisAlignItems: 'CENTER', itemSpacing: 8, paddingTop: 6, paddingBottom: 6 }); sp(r, 'paddingLeft', 'md'); sp(r, 'paddingRight', 'md'); fill(body, r);
      const kt = await T(k, 'body/base', 'text/secondary', { name: 'label' }); kt.textAutoResize = 'HEIGHT'; kt.resize(64, kt.height); r.appendChild(kt);
      const vt = mono ? await T(v, 'mono/xs', 'text/primary', { name: 'value' }) : await T(v, 'body/base', 'text/primary', { name: 'value' });
      r.appendChild(vt);
    }
    if (failed) {
      const wrap = AL('VERTICAL', 'error wrap', { paddingBottom: 12 }); sp(wrap, 'paddingLeft', 'md'); sp(wrap, 'paddingRight', 'md'); fill(c, wrap);
      const e = AL('HORIZONTAL', 'error', { itemSpacing: 8, strokeWeight: 1, cornerRadius: 6 }); pad(e, 'sm', 'sm'); e.fills = hex('#F85149', 0.08); e.strokes = hex('#F85149', 0.25); fill(wrap, e);
      e.appendChild(icon('XCircle-fill', 14, 'text/danger'));
      const et = await T('Connection failed. Check the server URL and try again.', 'body/xs', 'text/danger', Object.assign({ name: 'message' }, lh(18))); e.appendChild(et); et.layoutGrow = 1; et.textAutoResize = 'HEIGHT';
    }
    const foot = AL('HORIZONTAL', 'footer', { primaryAxisAlignItems: 'CENTER', strokeTopWeight: 1, strokeBottomWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 }); pad(foot, 'md', 'md'); foot.strokes = P('border'); fill(c, foot);
    const ct = await T('Close', 'body/base', 'text/accent', { name: 'close' }); ct.fontName = { family: 'Inter', style: 'Medium' }; foot.appendChild(ct);
    comps.push(c);
  }
  simpleSet(comps, sec, 'ServerErrorModal', 860, 'components/servers/ServerErrorModal.tsx. Opened from a server row; the error box only renders when the last connect failed.');
}

async function buildServersStatusModal() {
  if (findComp('ServersStatusModal')) return;
  const sec = newSection('ServersStatusModal', 'components/servers/ServersStatusModal.tsx — card bg-secondary, radius 16, padding 12, gap 8. Header: Cloud 18 + "Servers Status" 15/600 + close. Rows: name 15/500, URL 11 secondary, error 11 failed; ArrowsClockwise 14, 7px dot + 11/500 status, DotsThreeVertical bold 18 in 28×28. Ends with AddServerButton. Row menu sheet: Edit (accent), Refresh (secondary), Delete (danger).');
  const c = colComp('ServersStatusModal', 354, { cornerRadius: 16 }); pad(c, 'md', 'md'); sp(c, 'itemSpacing', 'sm'); c.fills = P('bg/secondary');
  const head = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER', itemSpacing: 8, paddingBottom: 4 }); fill(c, head);
  head.appendChild(icon('Cloud', 18, 'text/primary'));
  const ht = await T('Servers Status', 'label/base', 'text/primary', { name: 'title' }); head.appendChild(ht); ht.layoutGrow = 1;
  head.appendChild(icon('X', 18, 'text/secondary'));
  for (const [name, url, status, color, err] of [['Work Mac', '192.168.1.10:8766', 'Connected', 'status/running'], ['Home Server', 'home.local:8766', 'Connecting…', 'status/waiting'], ['Build box', '10.0.0.4:8766', 'Unreachable', 'status/failed', 'connect ECONNREFUSED']]) {
    const r = AL('HORIZONTAL', 'row', { counterAxisAlignItems: 'CENTER', itemSpacing: 8, strokeWeight: 1, cornerRadius: 10 }); pad(r, 'sm', 'md'); r.fills = P('bg/card'); r.strokes = P('border'); fill(c, r);
    const col = AL('VERTICAL', 'text', { itemSpacing: 2 }); r.appendChild(col); col.layoutGrow = 1;
    const nt = await T(name, 'body/base', 'text/primary', { name: 'name' }); nt.fontName = { family: 'Inter', style: 'Medium' }; col.appendChild(nt);
    col.appendChild(await T(url, 'body/xs', 'text/secondary', { name: 'url' }));
    if (err) col.appendChild(await T(err, 'body/xs', 'status/failed', { name: 'error' }));
    r.appendChild(icon('ArrowsClockwise', 14, 'text/secondary'));
    const st = AL('HORIZONTAL', 'status', { counterAxisAlignItems: 'CENTER', itemSpacing: 4 }); r.appendChild(st);
    st.appendChild(dot(7, color));
    const stt = await T(status, 'body/xs', color, { name: 'label' }); stt.fontName = { family: 'Inter', style: 'Medium' }; st.appendChild(stt);
    r.appendChild(iconBox('menu', 'DotsThreeVertical-bold', 18, 'text/secondary', 28));
  }
  fill(c, inst('AddServerButton'));
  single(c, sec, 'components/servers/ServersStatusModal.tsx. Opened from the StatusSheet "Server Status" action.');
  const m = colComp('ServerMenuSheet', 402, { strokeTopWeight: 1, strokeBottomWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0, paddingBottom: 28 }); corners(m, 16, 16, 0, 0); m.fills = P('bg/card'); m.strokes = P('border');
  const mt = AL('HORIZONTAL', 'title', Object.assign({ paddingTop: 10, paddingBottom: 10 }, LINE_B)); sp(mt, 'paddingLeft', 'md'); m.strokes = P('border'); mt.strokes = P('border'); fill(m, mt);
  mt.appendChild(await T('Work Mac', 'body/sm', 'text/secondary', { name: 'label' }));
  for (const [ic, label, color] of [['PencilSimple', 'Edit', 'text/accent'], ['ArrowsClockwise', 'Refresh', 'text/secondary'], ['Trash', 'Delete', 'text/danger']]) {
    const r = AL('HORIZONTAL', 'row', { counterAxisAlignItems: 'CENTER', itemSpacing: 8, paddingTop: 14, paddingBottom: 14 }); sp(r, 'paddingLeft', 'md'); fill(m, r);
    r.appendChild(icon(ic, 18, color)); r.appendChild(await T(label, 'body/base', color === 'text/secondary' ? 'text/primary' : color, { name: 'label' }));
  }
  m.description = 'components/servers/ServersStatusModal.tsx — the per-server menu sheet opened by the ⋮ button.';
  sec.appendChild(m); m.x = c.x + c.width + 60; m.y = c.y;
  sec.resizeWithoutConstraints(Math.max(sec.width, m.x + m.width + 40), Math.max(sec.height, m.y + m.height + 40));
}

async function buildCacheAlertModal() {
  if (findComp('CacheAlertModal')) return;
  const sec = newSection('CacheAlertModal', 'components/servers/CacheAlertModal.tsx — card bg-secondary, radius 16, padding 12, gap 8. WarningCircle fill 20 + title 15/600/20; hint 11/16 secondary; Select All / Select None 11/500 accent; items CheckCircle fill 18 accent / Circle 18 secondary + 13 name; stacked buttons 15/500 (Prune All, Prune Selected, Reset & Rescan, Ignore). Confirm step: "Are you sure?" + Cancel / Proceed (danger).');
  const comps = [];
  const btn = (label, color, o) => button(label, label, 'body/base', color, Object.assign({ stroke: ['border'], radius: 10, weight: 'Medium' }, o || {}));
  {
    const c = colComp('Step=List', 354, { cornerRadius: 16 }); pad(c, 'md', 'md'); sp(c, 'itemSpacing', 'sm'); c.fills = P('bg/secondary');
    const head = AL('HORIZONTAL', 'header', { itemSpacing: 8 }); fill(c, head);
    head.appendChild(icon('WarningCircle-fill', 20, 'status/waiting'));
    const t = await T('12 of 340 conversation histories are missing on Work Mac', 'label/base', 'text/primary', Object.assign({ name: 'title' }, lh(20))); head.appendChild(t); t.layoutGrow = 1; t.textAutoResize = 'HEIGHT';
    wrapText(c, await T('Consider checking a Time Machine (or equivalent) backup before doing anything destructive.', 'body/xs', 'text/secondary', Object.assign({ name: 'hint' }, lh(16))));
    const links = AL('HORIZONTAL', 'links', { itemSpacing: 16 }); c.appendChild(links);
    for (const l of ['Select All', 'Select None']) { const lt = await T(l, 'body/xs', 'text/accent', { name: 'link' }); lt.fontName = { family: 'Inter', style: 'Medium' }; links.appendChild(lt); }
    const list = AL('VERTICAL', 'items', { itemSpacing: 2 }); fill(c, list);
    for (const [name, on] of [['Refactor auth middleware', true], ['Fix login redirect', true], ['Release checklist', false]]) {
      const r = AL('HORIZONTAL', 'item', { counterAxisAlignItems: 'CENTER', itemSpacing: 8, paddingTop: 6, paddingBottom: 6 }); fill(list, r);
      r.appendChild(icon(on ? 'CheckCircle-fill' : 'Circle', 18, on ? 'text/accent' : 'text/secondary'));
      r.appendChild(await T(name, 'body/sm', 'text/primary', { name: 'name' }));
    }
    for (const [l, color] of [['Prune All', 'text/danger'], ['Prune Selected', 'text/danger'], ['Reset & Rescan', 'text/accent'], ['Ignore', 'text/secondary']]) fill(c, await btn(l, color));
    comps.push(c);
  }
  {
    const c = colComp('Step=Confirm', 354, { cornerRadius: 16 }); pad(c, 'md', 'md'); sp(c, 'itemSpacing', 'sm'); c.fills = P('bg/secondary');
    const head = AL('HORIZONTAL', 'header', { itemSpacing: 8, counterAxisAlignItems: 'CENTER' }); fill(c, head);
    head.appendChild(icon('WarningCircle-fill', 20, 'status/failed'));
    head.appendChild(await T('Are you sure?', 'label/base', 'text/primary', { name: 'title' }));
    wrapText(c, await T('This permanently removes all 12 missing conversations from the cache. This cannot be undone.', 'body/sm', 'text/secondary', Object.assign({ name: 'message' }, lh(18))));
    const row = AL('HORIZONTAL', 'actions', { itemSpacing: 8 }); fill(c, row);
    const a = await btn('Cancel', 'text/primary'); row.appendChild(a); a.layoutGrow = 1;
    const b = await btn('Proceed', 'text/onAccent', { fill: ['status/failed'], stroke: ['status/failed'] }); row.appendChild(b); b.layoutGrow = 1;
    comps.push(c);
  }
  simpleSet(comps, sec, 'CacheAlertModal', 860, 'components/servers/CacheAlertModal.tsx. Opened from the CacheAlert StatusRow "Review" action.');
}

async function chipNode(label, on, dotColor, count) {
  const c = AL('HORIZONTAL', 'chip', { counterAxisAlignItems: 'CENTER', itemSpacing: 6, minHeight: 36, strokeWeight: 1, paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4 }); rad(c, 'full');
  if (on) { c.strokes = P('text/accent'); PA(c, 'fills', 'text/accent', 0.12); } else c.strokes = P('border');
  if (on) c.appendChild(icon('Check-bold', 12, 'text/accent'));
  if (dotColor) c.appendChild(dot(8, dotColor));
  c.appendChild(await T(label, 'body/sm', on ? 'text/accent' : 'text/secondary', { name: 'label' }));
  if (count !== undefined) c.appendChild(await T(String(count), 'body/sm', 'text/secondary', { name: 'count' }));
  return c;
}
async function buildFilterSortSheet() {
  if (findComp('FilterSortSheet')) return;
  const sec = newSection('FilterSortSheet', 'components/servers/FilterSortSheet.tsx — bottom sheet bg-card, top radius 16. Header "Filter & Sort" 17/600 + Gear 20 + close; FilterPresets; eyebrows mono 11/600 uppercase 1.5 tracking; chips gap 6, radius full, padding 4×12, min 36 (selected: accent border, accent @12%, Check bold 12, count 13); ORDER segmented; SERVERS with LockSimple 18; footer Reset (accent outline) + "Show 42 results" (accent fill, bg-primary label).');
  const c = colComp('FilterSortSheet', 402, { paddingTop: 8 }); corners(c, 16, 16, 0, 0); c.fills = P('bg/card'); sp(c, 'paddingLeft', 'lg'); sp(c, 'paddingRight', 'lg'); sp(c, 'paddingBottom', 'xl'); sp(c, 'itemSpacing', 'lg');
  const handle = AL('HORIZONTAL', 'handle wrap', { primaryAxisAlignItems: 'CENTER' }); fill(c, handle); handle.appendChild(bar('handle', 36, 4, P('border'), 2));
  const head = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER', itemSpacing: 12 }); fill(c, head);
  const ht = await T('Filter & Sort', 'label/lg', 'text/primary', { name: 'title' }); head.appendChild(ht); ht.layoutGrow = 1;
  head.appendChild(icon('Gear', 20, 'text/secondary')); head.appendChild(icon('X', 20, 'text/secondary'));
  const presets = AL('HORIZONTAL', 'presets', { itemSpacing: 8 }); fill(c, presets);
  presets.appendChild(inst('FilterPresets', 'Preset=NeedsMe, State=Off')); presets.appendChild(inst('FilterPresets', 'Preset=Everything, State=On'));
  const group = async (title, chips) => {
    const g = AL('VERTICAL', 'group', { itemSpacing: 8 }); fill(c, g);
    g.appendChild(upper(await T(title, 'mono/xs', 'text/secondary', { name: 'eyebrow' }), 1.5));
    const w = AL('HORIZONTAL', 'chips', { layoutWrap: 'WRAP', itemSpacing: 6, counterAxisSpacing: 6 }); fill(g, w);
    for (const ch of chips) w.appendChild(await chipNode(...ch));
    return g;
  };
  await group('Show', [['Needs you', true, 'status/waiting', 3], ['Working', false, 'status/running', 5], ['Resumable', false, 'text/accent', 21], ['Can\'t resume', false, 'status/idle', 9], ['Observed', false, 'text/secondary', 4]]);
  await group('Agent', [['Claude', true], ['Codex', false], ['Cursor', false]]);
  await group('Active within', [['Any time', true], ['Today', false], ['7 days', false], ['30 days', false]]);
  const seg = async (title, opts) => {
    const g = AL('VERTICAL', 'segmented', { itemSpacing: 8 }); fill(c, g);
    g.appendChild(upper(await T(title, 'mono/xs', 'text/secondary', { name: 'eyebrow' }), 1.5));
    const s = AL('HORIZONTAL', 'segments', { strokeWeight: 1, cornerRadius: 10, clipsContent: true }); s.strokes = P('border'); fill(g, s);
    for (let i = 0; i < opts.length; i++) {
      const o = AL('HORIZONTAL', 'segment', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', minHeight: 36 }); s.appendChild(o); o.layoutGrow = 1;
      if (i === 0) PA(o, 'fills', 'text/accent', 0.12);
      o.appendChild(await T(opts[i], 'body/sm', i === 0 ? 'text/accent' : 'text/secondary', { name: 'label' }));
    }
  };
  await seg('Order', ['State, then recent', 'Recent', 'Project']);
  await seg('Within each group', ['Newest first', 'Oldest first']);
  const srv = await group('Servers', [['Work Mac', true], ['Build box', false]]);
  srv.children[0].remove();
  const sh = AL('HORIZONTAL', 'eyebrow row', { counterAxisAlignItems: 'CENTER', itemSpacing: 6 }); srv.insertChild(0, sh);
  sh.appendChild(upper(await T('Servers', 'mono/xs', 'text/secondary', { name: 'eyebrow' }), 1.5)); sh.appendChild(icon('LockSimple', 18, 'text/secondary'));
  const foot = AL('HORIZONTAL', 'footer', { itemSpacing: 8, paddingTop: 4 }); fill(c, foot);
  const r = await button('Reset', 'Reset', 'label/base', 'text/accent', { stroke: ['text/accent'], radius: 10 }); foot.appendChild(r); r.layoutGrow = 1;
  const s = await button('Show', 'Show 42 results', 'label/base', 'bg/primary', { fill: ['text/accent'], radius: 10 }); foot.appendChild(s); s.layoutGrow = 1;
  single(c, sec, 'components/servers/FilterSortSheet.tsx. Opened from the Funnel button on Now / Projects.');
}

async function buildServerAlertRows() {
  const set = findComp('StatusRow');
  if (!set || set.children.some(c => c.name === 'Kind=CacheAlert')) return;
  for (const [kind, level, title, msg, actions] of [
    ['CacheAlert', 'Warning', '3 conversation histories are missing on Work Mac', 'Review them before pruning anything from the cache.', [['Review', false]]],
    ['HostPressure', 'Warning', 'Work Mac is under memory pressure.', 'New sessions may be slow until something is closed on the computer.', []],
    ['ServerState', 'Error', 'Work Mac', 'Can\'t reach Work Mac. Check your connection or server address.', [['Retry', true]]],
  ]) set.appendChild(await statusRow('Kind=' + kind, level, title, msg, actions));
  set.description += ' CacheAlert / HostPressure / ServerState are the rows raised by components/servers/CacheAlertBanner, HostPressureBanner and ServerStateMessage, which render no UI of their own.';
  const sec = set.parent; sec.resizeWithoutConstraints(sec.width, set.y + set.height + 40);
}

// ---------- batch 6: servers, pair, browse ----------
const WHITE = hex('#ffffff');
const LINE_T = { strokeTopWeight: 0.5, strokeBottomWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 };
const HAIR_B = { strokeBottomWeight: 0.5, strokeTopWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 };
// Bottom-sheet body: bg-secondary, top radius 16, border-colored drag handle.
async function sheet(name, title) {
  const c = colComp(name, 402); corners(c, 16, 16, 0, 0); c.fills = P('bg/secondary');
  pad(c, 'md', 'md'); c.paddingTop = 8; sp(c, 'itemSpacing', 'md');
  const handle = AL('HORIZONTAL', 'handle wrap', { primaryAxisAlignItems: 'CENTER' }); fill(c, handle);
  handle.appendChild(bar('handle', 36, 4, P('border'), 2));
  if (title) c.appendChild(await T(title, 'label/lg', 'text/primary', { name: 'title' }));
  return c;
}
function screenComp(name, fills) {
  const c = comp(name, 'VERTICAL', { clipsContent: true });
  c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'FIXED'; c.resize(402, 874); c.fills = fills;
  return c;
}
// Banner-shaped wait card with a spinner, in the warning accent.
async function slowBanner(name, title, message, desc) {
  const sec = newSection(name, desc);
  const c = colComp(name, 240, { counterAxisAlignItems: 'CENTER', cornerRadius: 12, strokeWeight: 1 });
  pad(c, 'lg', 'xl'); sp(c, 'itemSpacing', 'md'); c.fills = P('bg/card'); c.strokes = P('text/warning');
  c.appendChild(icon('CircleNotch', 20, 'text/warning'));
  wrapText(c, await T(title, 'label/base', 'text/primary', { name: 'title', textAlignHorizontal: 'CENTER' }));
  wrapText(c, await T(message, 'body/sm', 'text/warning', Object.assign({ name: 'message', textAlignHorizontal: 'CENTER' }, lh(19))));
  fill(c, await button('cancel', 'Cancel', 'label/sm', 'text/danger', { fill: ['bg/secondary'], stroke: ['text/danger'], radius: 8, pv: 4, ph: 16, minHeight: null }));
  single(c, sec, desc);
}

async function pickerRow(label, url, reachable) {
  const r = AL('HORIZONTAL', 'server', { counterAxisAlignItems: 'CENTER', minHeight: 44, strokeWeight: 1 }); pad(r, 'sm', 'md'); sp(r, 'itemSpacing', 'md'); rad(r, 'md');
  r.fills = P('bg/card'); r.strokes = P('border');
  r.appendChild(dot(8, reachable ? 'status/running' : 'status/failed'));
  const col = AL('VERTICAL', 'info', { itemSpacing: 4 }); r.appendChild(col); col.layoutGrow = 1;
  col.appendChild(await T(label || url, 'title/base-medium', 'text/primary', { name: 'label' }));
  if (label) col.appendChild(await T(url, 'body/xs', 'text/secondary', { name: 'url' }));
  if (!reachable) col.appendChild(await T('Unreachable', 'body/xs', 'status/failed', { name: 'unreachable' }));
  r.appendChild(icon('CaretRight', 18, 'text/secondary'));
  return r;
}
async function buildNewSessionServerPicker() {
  if (findComp('NewSessionServerPicker')) return;
  const sec = newSection('NewSessionServerPicker', 'components/servers/NewSessionServerPicker.tsx — bottom sheet (40% / 70%), bg-secondary, dimmed backdrop. Content padding 12, gap 12: "Start session on" 17/600. Rows gap 8: min 44, padding 8×12, gap 12, radius 10, 1px border, bg-card; 8px dot (running / failed), label 15/500 + URL 11 secondary (the URL is the main line when there is no label), "Unreachable" 11 failed, CaretRight 18. Cancel: text button 15 secondary, bottom right.');
  const comps = [];
  for (const state of ['Reachable', 'Unreachable']) {
    const c = await sheet('State=' + state, 'Start session on');
    const list = AL('VERTICAL', 'servers'); sp(list, 'itemSpacing', 'sm'); fill(c, list);
    fill(list, await pickerRow('Work Mac', 'http://192.168.1.24:8766', true));
    fill(list, await pickerRow(null, 'https://ronen-mbp.tail1234.ts.net', state === 'Reachable'));
    fill(list, await pickerRow('Home Server', 'http://10.0.0.5:8766', true));
    const act = AL('HORIZONTAL', 'actions', { primaryAxisAlignItems: 'MAX', paddingTop: 8 }); fill(c, act);
    act.appendChild(await button('cancel', 'Cancel', 'body/base', 'text/secondary', {}));
    comps.push(c);
  }
  simpleSet(comps, sec, 'NewSessionServerPicker', 900, 'components/servers/NewSessionServerPicker.tsx. <NewSessionServerPicker visible servers onSelect onClose />. Glass themes make the sheet and rows transparent.');
}

async function flagChip(label, on) {
  const ch = AL('HORIZONTAL', 'chip', { counterAxisAlignItems: 'CENTER', minHeight: 44, cornerRadius: 6 }); sp(ch, 'paddingLeft', 'sm'); sp(ch, 'paddingRight', 'sm');
  ch.fills = P(on ? 'text/accent' : 'bg/secondary');
  ch.appendChild(await T(label, 'body/xs', on ? WHITE : 'text/secondary', { name: 'label' }));
  return ch;
}
async function flagChips(labels, selected) {
  const row = AL('HORIZONTAL', 'chips', { layoutWrap: 'WRAP', itemSpacing: 4, counterAxisSpacing: 4, primaryAxisAlignItems: 'MAX' });
  row.primaryAxisSizingMode = 'FIXED'; row.resize(180, 44);
  for (const l of labels) row.appendChild(await flagChip(l, l === selected));
  return row;
}
async function flagInput(placeholder, value) {
  const i = AL('HORIZONTAL', 'input', { cornerRadius: 6, paddingTop: 4, paddingBottom: 4, counterAxisAlignItems: 'CENTER' }); sp(i, 'paddingLeft', 'sm'); sp(i, 'paddingRight', 'sm');
  i.fills = P('bg/secondary'); i.primaryAxisSizingMode = 'FIXED'; i.resize(150, 24);
  const t = await T(value || placeholder, 'body/sm', value ? 'text/primary' : 'text/secondary', { name: 'value' });
  i.appendChild(t); t.layoutGrow = 1; t.textAutoResize = 'HEIGHT'; t.textTruncation = 'ENDING'; t.maxLines = 1;
  return i;
}
async function flagRow(parent, label, desc, control, danger) {
  const r = AL('HORIZONTAL', 'flag', Object.assign({ counterAxisAlignItems: 'CENTER', itemSpacing: 8, paddingTop: 8, paddingBottom: 8 }, HAIR_B)); r.strokes = P('border');
  fill(parent, r);
  const col = AL('VERTICAL', 'text', { itemSpacing: 2 }); r.appendChild(col); col.layoutGrow = 1;
  wrapText(col, styled(await T(label, 'body/sm', danger ? 'text/danger' : 'text/primary', { name: 'label' }), 'Medium'));
  wrapText(col, await T(desc, 'body/xs', 'text/secondary', { name: 'description' }));
  r.appendChild(control);
}
async function buildServerClaudeFlagsSection() {
  if (findComp('ServerClaudeFlagsSection')) return;
  const sec = newSection('ServerClaudeFlagsSection', 'components/servers/ServerClaudeFlagsSection.tsx — column gap 8: "Claude CLI flags" 15/600, description 13 secondary, optional warning box (bg-secondary, radius 6, padding 8, 13 secondary). Flag rows: padding 8 vertical, hairline bottom; label 13/500 (text.danger when dangerous) + description 11 secondary; control max 55%: enum chips (min 44, radius 6, bg-secondary, 11 secondary; selected accent with white), input (bg-secondary, radius 6, padding 4×8, 13), model input + chips. Extra arguments input. Save: accent, radius 10, padding 8, "Save flags" 13/600 white; pending 60% with a white spinner. Loading: a centered accent spinner only.');
  const comps = [];
  for (const state of ['Default', 'Dangerous']) {
    const danger = state === 'Dangerous';
    const c = colComp('State=' + state, 330); sp(c, 'itemSpacing', 'sm'); c.fills = P('bg/card'); c.paddingTop = 16;
    c.appendChild(await T('Claude CLI flags', 'label/base', 'text/primary', { name: 'title' }));
    wrapText(c, await T('Applied to every session this server starts. Takes effect on the next session.', 'body/sm', 'text/secondary', { name: 'description' }));
    if (danger) {
      const w = AL('VERTICAL', 'warning', { cornerRadius: 6 }); pad(w, 'sm', 'sm'); w.fills = P('bg/secondary'); fill(c, w);
      wrapText(w, await T('This server was started with command-line flags, so changes apply now but reset on restart.', 'body/sm', 'text/secondary', { name: 'message' }));
    }
    await flagRow(c, 'Permission mode', 'How much Claude asks before acting. Bypass modes remove every confirmation.', await flagChips(['default', 'acceptEdits', 'plan', 'bypassPermissions'], danger ? 'bypassPermissions' : 'acceptEdits'), danger);
    await flagRow(c, 'Additional directories', 'Extra folders Claude may read and edit, beyond the project.', await flagInput('Comma-separated', danger ? '~/dev/shared' : null));
    await flagRow(c, 'Allowed tools', 'Only these tools run without asking. A safer alternative to bypass mode.', await flagInput('Comma-separated', danger ? null : 'Read, Grep, Bash(npm test)'));
    await flagRow(c, 'Blocked tools', 'Tools Claude may never run on this server.', await flagInput('Comma-separated'));
    await flagRow(c, 'Budget limit (USD)', 'Caps what one session can spend. Useful when prompts are disabled.', await flagInput('--max-budget-usd', danger ? '5' : null));
    const model = AL('VERTICAL', 'model', { itemSpacing: 4, counterAxisAlignItems: 'MAX' });
    model.appendChild(await flagInput('--fallback-model')); model.appendChild(await flagChips(['sonnet', 'opus', 'haiku'], null));
    await flagRow(c, 'Fallback model', 'Model to switch to if the main one is unavailable.', model);
    c.appendChild(styled(await T('Extra arguments', 'body/sm', 'text/primary', { name: 'label' }), 'Medium'));
    wrapText(c, await T('Passed through as-is and not validated. Use at your own risk.', 'body/xs', 'text/secondary', { name: 'description' }));
    c.appendChild(await flagInput('--bare --agent reviewer'));
    const save = await button('save', 'Save flags', 'label/sm', WHITE, { fill: ['text/accent'], radius: 10, pv: 8, minHeight: null });
    save.paddingTop = 8; fill(c, save);
    if (danger) { save.children[0].remove(); save.appendChild(icon('CircleNotch', 16, WHITE)); save.opacity = 0.6; }
    comps.push(c);
  }
  simpleSet(comps, sec, 'ServerClaudeFlagsSection', 760, 'components/servers/ServerClaudeFlagsSection.tsx. Edit-server screen only. Dangerous = bypassPermissions selected, flags not persisted (warning box) and Save pending.');
}

async function buildServerEncryptionSection() {
  if (findComp('ServerEncryptionSection')) return;
  const sec = newSection('ServerEncryptionSection', 'components/servers/ServerEncryptionSection.tsx — column gap 12, padding top 8, hairline top border. Top: IdentityFingerprintBlock, or the no-identity block (ShieldWarning fill 18 warning + "No identity to verify" 15/700, body 13/18 secondary). Toggle row gap 12: "Require encryption for this server" 15/600 + 11/16 secondary, Switch (border off, accent on).');
  const comps = [];
  for (const state of ['Fingerprint', 'NoIdentity']) {
    const c = colComp('State=' + state, 330, LINE_T); sp(c, 'itemSpacing', 'md'); c.paddingTop = 8; c.fills = P('bg/card'); c.strokes = P('border');
    if (state === 'Fingerprint') {
      const b = inst('IdentityFingerprintBlock', 'Context=DeepLink'); b.fills = []; fill(c, b);
    } else {
      const blk = AL('VERTICAL', 'no identity', { itemSpacing: 4 }); fill(c, blk);
      const h = AL('HORIZONTAL', 'heading', { counterAxisAlignItems: 'CENTER', itemSpacing: 8 }); fill(blk, h);
      h.appendChild(icon('ShieldWarning-fill', 18, 'text/warning'));
      const t = styled(await T('No identity to verify', 'label/base', 'text/primary', { name: 'title' }), 'Bold'); h.appendChild(t); t.layoutGrow = 1;
      wrapText(blk, await T('This link doesn\'t include an identity code, so you can\'t check which computer it belongs to. Anything you send will be readable by anything between this device and the server.', 'body/sm', 'text/secondary', Object.assign({ name: 'body' }, lh(18))));
    }
    const row = AL('HORIZONTAL', 'toggle', { counterAxisAlignItems: 'CENTER', itemSpacing: 12 }); fill(c, row);
    const col = AL('VERTICAL', 'text', { itemSpacing: 2 }); row.appendChild(col); col.layoutGrow = 1;
    wrapText(col, await T('Require encryption for this server', 'label/base', 'text/primary', { name: 'title' }));
    wrapText(col, await T('This device will refuse to talk to it in plaintext.', 'body/xs', 'text/secondary', Object.assign({ name: 'description' }, lh(16))));
    row.appendChild(switchNode(state === 'Fingerprint'));
    comps.push(c);
  }
  simpleSet(comps, sec, 'ServerEncryptionSection', 760, 'components/servers/ServerEncryptionSection.tsx. Edit-server screen. The fingerprint block uses the settings wording in code; the DeepLink variant stands in for it here.');
}

async function buildServerEditModal() {
  if (findComp('ServerEditModal')) return;
  const sec = newSection('ServerEditModal', 'components/servers/ServerEditModal.tsx — centered over rgba(0,0,0,0.6), padding 24. Card bg-card, radius 16, 1px border, max 85% high. Header padding 12, hairline bottom: "Add Server" / "Edit Server" 15/600 + X 20. Body padding 12, gap 8: ServerFormFields (QrCode 18 accent label accessory), optional error box (#f85149 at 8% fill / 25% border, radius 6, padding 8, XCircle fill 14 + 15/18 danger), Save (accent, radius 10, padding 12, min 44, 15/600 onAccent; 40% when URL or key is empty). Edit mode adds ServerEncryptionSection and ServerClaudeFlagsSection.');
  const comps = [];
  for (const state of ['AddEmpty', 'AddError', 'Edit']) {
    const c = colComp('State=' + state, 354, { strokeWeight: 1, cornerRadius: 16, clipsContent: true }); c.fills = P('bg/card'); c.strokes = P('border');
    const head = AL('HORIZONTAL', 'header', Object.assign({ counterAxisAlignItems: 'CENTER' }, HAIR_B)); pad(head, 'md', 'md'); head.strokes = P('border'); fill(c, head);
    const t = await T(state === 'Edit' ? 'Edit Server' : 'Add Server', 'label/base', 'text/primary', { name: 'title' }); head.appendChild(t); t.layoutGrow = 1;
    head.appendChild(iconBox('close', 'X', 20, 'text/secondary', 28));
    const body = AL('VERTICAL', 'body'); pad(body, 'md', 'md'); sp(body, 'itemSpacing', 'sm'); fill(c, body);
    const form = inst('ServerFormFields'); form.fills = []; form.paddingLeft = form.paddingRight = form.paddingTop = form.paddingBottom = 0; fill(body, form);
    if (state === 'AddEmpty') {
      const url = form.findAll(n => n.type === 'TEXT' && n.name === 'value')[1];
      url.characters = '192.168.1.10:8766'; url.fills = P('text/secondary');
    }
    if (state === 'AddError') {
      const e = AL('HORIZONTAL', 'error', { itemSpacing: 8, cornerRadius: 6, strokeWeight: 1 }); pad(e, 'sm', 'sm');
      e.fills = hex('#f85149', 0.08); e.strokes = hex('#f85149', 0.25); fill(body, e);
      e.appendChild(icon('XCircle-fill', 14, 'text/danger'));
      const m = await T('Connection failed. Check the server URL and try again.', 'body/base', 'text/danger', Object.assign({ name: 'message' }, lh(18))); e.appendChild(m); m.layoutGrow = 1; m.textAutoResize = 'HEIGHT';
    }
    const save = await button('save', 'Save', 'label/base', 'text/onAccent', { fill: ['text/accent'], radius: 10, pv: 12 });
    fill(body, save); if (state === 'AddEmpty') save.opacity = 0.4;
    if (state === 'Edit') {
      fill(body, inst('ServerEncryptionSection', 'State=Fingerprint'));
      fill(body, inst('ServerClaudeFlagsSection', 'State=Default'));
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'ServerEditModal', 1240, 'components/servers/ServerEditModal.tsx. <ServerEditModal visible server onSave onClose />. Scrim not included. Opens PairScannerModal, PairConfirmGate and PairCameraIdentityCard as separate modals.');
}

async function filterChip(label, on, dotColor) {
  const c = AL('HORIZONTAL', 'chip', { counterAxisAlignItems: 'CENTER', itemSpacing: 4, minHeight: 36, strokeWeight: 1, paddingTop: 4, paddingBottom: 4 }); sp(c, 'paddingLeft', 'md'); sp(c, 'paddingRight', 'md'); rad(c, 'full');
  c.strokes = P(on ? 'text/accent' : 'border'); c.fills = P(on ? 'bg/primary' : 'bg/card');
  if (dotColor) c.appendChild(dot(8, dotColor));
  c.appendChild(await T(label, 'title/base-medium', on ? 'text/primary' : 'text/secondary', { name: 'label' }));
  return c;
}
async function filterSection(parent, title, chips, quick) {
  const s = AL('VERTICAL', title, { itemSpacing: 8 }); fill(parent, s);
  const h = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER' }); fill(s, h);
  const t = await T(title, 'label/base', 'text/primary', { name: 'title' }); h.appendChild(t); t.layoutGrow = 1;
  if (quick) for (const q of ['All', 'None']) {
    const b = await button(q, q, 'label/xs-medium', 'text/secondary', { fill: ['bg/card'], stroke: ['border'], radius: 6, ph: 8, pv: 4, minHeight: 32 });
    h.appendChild(b); h.itemSpacing = 8;
  }
  const row = AL('HORIZONTAL', 'chips', { layoutWrap: 'WRAP', itemSpacing: 8, counterAxisSpacing: 8 }); fill(s, row);
  for (const ch of chips) row.appendChild(await filterChip(...ch));
}
async function buildServerFilterSheet() {
  if (findComp('ServerFilterSheet')) return;
  const sec = newSection('ServerFilterSheet', 'components/servers/ServerFilterSheet.tsx — bottom sheet (50% / 85%), bg-secondary. Content padding 12, gap 12: "Filters" 17/600 + close. Sections gap 8, title 15/600. Chips: pill, padding 4×12, min 36, 1px border, bg-card, 15/500 secondary; selected: accent border, bg-primary, primary text. Status: All / None quick buttons (bg-card, border, radius 6, padding 4×8, min 32, 11/500) and 8px status dots. Servers section (DisplayedServersList) only with more than one server; not drawn here. Cancel 15 secondary / Apply 15/600 accent.');
  const comps = [];
  for (const state of ['Default', 'StatusNone']) {
    const c = await sheet('State=' + state);
    const tr = AL('HORIZONTAL', 'title row', { counterAxisAlignItems: 'CENTER' }); fill(c, tr);
    const t = await T('Filters', 'label/lg', 'text/primary', { name: 'title' }); tr.appendChild(t); t.layoutGrow = 1;
    tr.appendChild(iconBox('close', 'X', 17, 'text/secondary', 25));
    await filterSection(c, 'Sort by', [['Last activity', true], ['Started', false]]);
    const on = state === 'Default';
    await filterSection(c, 'Status', [['Running', on, 'status/running'], ['Idle', on, 'status/idle']], true);
    const act = AL('HORIZONTAL', 'actions', { primaryAxisAlignItems: 'MAX', itemSpacing: 8, paddingTop: 8 }); fill(c, act);
    act.appendChild(await button('cancel', 'Cancel', 'body/base', 'text/secondary', {}));
    act.appendChild(await button('apply', 'Apply', 'label/base', 'text/accent', {}));
    comps.push(c);
  }
  simpleSet(comps, sec, 'ServerFilterSheet', 900, 'components/servers/ServerFilterSheet.tsx. <ServerFilterSheet visible filters onApply onClose />. "Last activity" and "Started" are hardcoded in code, not translated. The close control is a "✕" text glyph in code; drawn with the X icon.');
}

async function buildPairConfirmGate() {
  if (findComp('PairConfirmGate')) return;
  const sec = newSection('PairConfirmGate', 'components/pair/PairConfirmGate.tsx — fullscreen, bg-primary. ScreenHeader "Pairing". Content padding 16 / 24 bottom, gap 12: heading (shield 22 fill + title 17/700), detail rows (13 secondary label 96 wide + 13 primary value; Address in mono 11), IdentityFingerprintBlock (e2ee only), body 13/19 (primary for e2ee, text.warning otherwise). Action bar gap 8, padding 8/16/12, hairline top: Cancel (min 44, radius 10, border, bg-card, 15/600) and "Add server" (accent or warning border, 15/700).');
  const kinds = [
    ['e2ee', 'ShieldCheck-fill', 'text/success', 'Is this the computer you meant?', true, true, 'Encrypted from this device to this computer.'],
    ['no-spk', 'ShieldWarning-fill', 'text/warning', 'No identity to verify', true, false, 'This link doesn\'t include an identity code, so you can\'t check which computer it belongs to. Anything you send will be readable by anything between this device and the server.'],
    ['api-key', 'ShieldSlash-fill', 'text/warning', 'Add server with a pasted key?', false, false, 'This key was typed or pasted, not exchanged with the server. It can\'t be tied to a specific device or verified — only use a key from a source you trust.'],
  ];
  const comps = [];
  for (const [kind, ic, color, title, machine, fp, body] of kinds) {
    const c = screenComp('Kind=' + kind, P('bg/primary'));
    const hdr = inst('ScreenHeader', 'Kind=Title'); setInstanceText(hdr, 'title', 'Pairing'); fill(c, hdr);
    const content = AL('VERTICAL', 'content'); sp(content, 'itemSpacing', 'md'); pad(content, 'lg', 'lg'); sp(content, 'paddingBottom', 'xl'); fill(c, content); content.layoutGrow = 1;
    const h = AL('HORIZONTAL', 'heading', { counterAxisAlignItems: 'CENTER', itemSpacing: 8 }); fill(content, h);
    h.appendChild(icon(ic, 22, color));
    const t = styled(await T(title, 'label/lg', 'text/primary', { name: 'title' }), 'Bold'); h.appendChild(t); t.layoutGrow = 1; t.textAutoResize = 'HEIGHT';
    const rows = AL('VERTICAL', 'details', { itemSpacing: 4 }); fill(content, rows);
    const detail = async (label, value, mono) => {
      const r = AL('HORIZONTAL', 'detail', { itemSpacing: 12 }); fill(rows, r);
      const l = await T(label, 'body/sm', 'text/secondary', { name: 'label' }); r.appendChild(l); l.textAutoResize = 'HEIGHT'; l.resize(96, l.height);
      const v = await T(value, mono ? 'mono/xs' : 'body/sm', 'text/primary', { name: 'value' }); r.appendChild(v); v.layoutGrow = 1; v.textAutoResize = 'HEIGHT';
    };
    if (machine) await detail('Machine', 'Ronen\'s MacBook Pro');
    await detail('Address', 'https://ronen-mbp.tail1234.ts.net', true);
    if (fp) { const b = inst('IdentityFingerprintBlock', 'Context=DeepLink'); b.fills = []; fill(content, b); }
    wrapText(content, await T(body, 'body/sm', kind === 'e2ee' ? 'text/primary' : 'text/warning', Object.assign({ name: 'body' }, lh(19))));
    const bar_ = AL('HORIZONTAL', 'actions', Object.assign({ itemSpacing: 8, paddingTop: 8, paddingBottom: 12 }, LINE_T)); sp(bar_, 'paddingLeft', 'lg'); sp(bar_, 'paddingRight', 'lg'); bar_.strokes = P('border'); fill(c, bar_);
    const accent = kind === 'e2ee' ? 'text/accent' : 'text/warning';
    for (const [label, stroke, tc, w] of [['Cancel', 'border', 'text/primary', null], ['Add server', accent, accent, 'Bold']]) {
      const b = await button(label, label, 'label/base', tc, { fill: ['bg/card'], stroke: [stroke], radius: 10, pv: 8, weight: w });
      bar_.appendChild(b); b.layoutGrow = 1;
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'PairConfirmGate', 1400, 'components/pair/PairConfirmGate.tsx. <PairConfirmGate pending onConfirm onCancel />. Shown before a deep link or scanned QR adds a server. Machine falls back to "Unnamed machine".');
}

async function buildPairScannerModal() {
  if (findComp('PairScannerModal')) return;
  const sec = newSection('PairScannerModal', 'components/pair/PairScannerModal.tsx — fullscreen #000, no safe area. Close: absolute top 56 / end 20, 40 circle rgba(0,0,0,0.55), "×" 28/30 white. Scanning: camera feed + centered reticle 240×240 (2px white, radius 16) and hint 15 white with a 0.7 shadow. Other states: centered column, padding 24, gap 12; primary button accent, radius 10, padding 12×24, 15/700 onAccent. Note: text.primary on #000 is low contrast in light themes.');
  const comps = [];
  for (const state of ['Scanning', 'Permission', 'Exchanging', 'Error']) {
    const c = screenComp('State=' + state, hex('#000000'));
    c.primaryAxisAlignItems = 'CENTER'; c.counterAxisAlignItems = 'CENTER'; sp(c, 'itemSpacing', 'md'); pad(c, 'xl', 'xl');
    if (state === 'Scanning') {
      const feed = figma.createRectangle(); feed.name = 'camera feed'; feed.resize(402, 874);
      feed.fills = [{ type: 'GRADIENT_LINEAR', gradientTransform: [[0, 1, 0], [-1, 0, 1]], gradientStops: [{ position: 0, color: { r: 0.16, g: 0.18, b: 0.2, a: 1 } }, { position: 1, color: { r: 0.06, g: 0.07, b: 0.08, a: 1 } }] }];
      c.appendChild(feed); feed.layoutPositioning = 'ABSOLUTE'; feed.x = 0; feed.y = 0;
      c.itemSpacing = 16;
      const r = figma.createRectangle(); r.name = 'reticle'; r.resize(240, 240); r.cornerRadius = 16; r.fills = []; r.strokes = WHITE; r.strokeWeight = 2; c.appendChild(r);
      const hint = await T('Point at the QR shown by your server', 'body/base', WHITE, { name: 'hint' });
      hint.effects = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.7 }, offset: { x: 0, y: 0 }, radius: 6, spread: 0, visible: true, blendMode: 'NORMAL' }];
      c.appendChild(hint);
    } else if (state === 'Exchanging') {
      c.appendChild(icon('CircleNotch', 32, 'text/primary'));
      c.appendChild(await T('Exchanging pair token…', 'body/base', 'text/primary', { name: 'message' }));
    } else {
      const perm = state === 'Permission';
      const t = await T(perm ? 'Camera access' : 'Pairing failed', perm ? 'label/xl' : 'label/lg', perm ? 'text/primary' : 'text/danger', { name: 'title', textAlignHorizontal: 'CENTER' });
      styled(t, 'Bold'); c.appendChild(t);
      wrapText(c, await T(perm ? 'Threadbase needs camera access to scan a pairing QR code shown by your server.' : 'Could not reach that server. Check that the streamer is running and your phone is on the same network.', 'body/base', perm ? 'text/secondary' : 'text/primary', Object.assign({ name: 'body', textAlignHorizontal: 'CENTER' }, lh(22))));
      const b = await button('primary', perm ? 'Continue' : 'Try again', 'label/base', 'text/onAccent', { fill: ['text/accent'], radius: 10, ph: 24, pv: 12, weight: 'Bold' });
      c.appendChild(b);
      if (!perm) c.appendChild(await T('Need help? Contact support', 'label/sm', 'text/accent', { name: 'support' }));
    }
    const close = AL('HORIZONTAL', 'close', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', cornerRadius: 20 });
    close.primaryAxisSizingMode = 'FIXED'; close.counterAxisSizingMode = 'FIXED'; close.resize(40, 40); close.fills = hex('#000000', 0.55);
    const x = rawText('×', 28, 'Regular', WHITE); x.lineHeight = { unit: 'PIXELS', value: 30 }; close.appendChild(x);
    c.appendChild(close); close.layoutPositioning = 'ABSOLUTE'; close.x = 402 - 20 - 40; close.y = 56;
    comps.push(c);
  }
  simpleSet(comps, sec, 'PairScannerModal', 1800, 'components/pair/PairScannerModal.tsx. <PairScannerModal visible onScanned onClose />. Permission denied: hint "Camera access is disabled. Open Settings to enable it for Threadbase." (13 warning) and "Open Settings". Already added: "Server already added" / "This address is already in your list. Delete that server first if you want to add it again." with no button.');
}

async function buildRecentDirsModal() {
  if (findComp('RecentDirsModal')) return;
  const sec = newSection('RecentDirsModal', 'components/browse/RecentDirsModal.tsx — iOS page sheet, bg-primary. Header padding 12×16, hairline bottom: "Recent directories" 17/600 + X 22 in a 44 box. Search: margin 12×16, padding 0×12, gap 8, radius 10, bg-secondary, 1px border, MagnifyingGlass 16 + 15 input ("Search locations"). Rows padding 12×16, gap 12, hairline bottom: ClockCounterClockwise 18 secondary, name 15 primary + path 11 secondary, CaretRight 16. Empty: "No matching locations" 13 secondary, centered, padding 24×16.');
  const dirs = [['tb-mobile', '~/dev/ai-tools/tb-mobile'], ['tb-streamer', '~/dev/ai-tools/tb-streamer'], ['threadbase', '~/dev/ai-tools/threadbase'], ['ledger-api', '~/work/ledger-api'], ['dotfiles', '~/dotfiles'], ['tb-figma-plugin', '~/dev/ai-tools/tb-figma-plugin']];
  const comps = [];
  for (const [state, query] of [['List', null], ['Search', 'tb-'], ['Empty', 'kotlin']]) {
    const c = colComp('State=' + state, 402); c.fills = P('bg/primary');
    const head = AL('HORIZONTAL', 'header', Object.assign({ counterAxisAlignItems: 'CENTER' }, HAIR_B)); sp(head, 'paddingLeft', 'lg'); sp(head, 'paddingRight', 'lg'); head.paddingTop = head.paddingBottom = 0; head.strokes = P('border'); fill(c, head);
    const t = await T('Recent directories', 'label/lg', 'text/primary', { name: 'title' }); head.appendChild(t); t.layoutGrow = 1;
    head.appendChild(iconBox('close', 'X', 22, 'text/secondary', 44));
    const wrap = AL('VERTICAL', 'search wrap'); pad(wrap, 'md', 'lg'); fill(c, wrap);
    const s = AL('HORIZONTAL', 'search', { counterAxisAlignItems: 'CENTER', itemSpacing: 8, strokeWeight: 1, cornerRadius: 10 }); sp(s, 'paddingLeft', 'md'); sp(s, 'paddingRight', 'md'); s.fills = P('bg/secondary'); s.strokes = P('border'); fill(wrap, s);
    s.appendChild(icon('MagnifyingGlass', 16, 'text/secondary'));
    const q = await T(query || 'Search locations', 'body/base', query ? 'text/primary' : 'text/secondary', { name: 'value' }); s.appendChild(q); q.layoutGrow = 1;
    s.paddingTop = s.paddingBottom = 8;
    const shown = query ? dirs.filter(d => d[0].startsWith(query)) : dirs;
    for (const [name, path] of shown) {
      const r = AL('HORIZONTAL', 'dir', Object.assign({ counterAxisAlignItems: 'CENTER', itemSpacing: 12 }, HAIR_B)); pad(r, 'md', 'lg'); r.strokes = P('border'); fill(c, r);
      r.appendChild(icon('ClockCounterClockwise', 18, 'text/secondary'));
      const col = AL('VERTICAL', 'text', { itemSpacing: 2 }); r.appendChild(col); col.layoutGrow = 1;
      col.appendChild(await T(name, 'body/base', 'text/primary', { name: 'name' }));
      col.appendChild(await T(path, 'body/xs', 'text/secondary', { name: 'path' }));
      r.appendChild(icon('CaretRight', 16, 'text/secondary'));
    }
    if (!shown.length) {
      const e = AL('VERTICAL', 'empty', { counterAxisAlignItems: 'CENTER' }); pad(e, 'xl', 'lg'); fill(c, e);
      e.appendChild(await T('No matching locations', 'body/sm', 'text/secondary', { name: 'message' }));
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'RecentDirsModal', 1400, 'components/browse/RecentDirsModal.tsx. <RecentDirsModal visible onSelect onClose />. Recent folders from the browse screen; bottom safe area only.');
}

async function buildBrowseSlowBanner() {
  if (findComp('BrowseSlowBanner')) return;
  await slowBanner('BrowseSlowBanner', 'That\'s a heavy file tree…', 'Didn\'t think it\'d be this big. Give us just a moment.', 'components/browse/BrowseSlowBanner.tsx — a Banner with a text.warning accent and spinner, a destructive Cancel action. Same layout as SlowLoadingBanner. Centered over a 55% black scrim.');
}

// ---------- batch 7: components/sessions ----------
const TIER = { needsYou: ['status/waiting', 'Needs you'], working: ['status/running', 'Working'], resumable: ['status/idle', 'Resumable'], cantResume: ['status/failed', 'Can\'t resume'] };
// A component holding one instance of an existing component, for wrappers that add no visuals.
// Fixed width with a FILL child, so resizing an instance stretches the wrapped one.
function wrapComp(name, child) {
  const c = comp(name, 'VERTICAL'); c.appendChild(child); c.counterAxisSizingMode = 'FIXED'; child.layoutSizingHorizontal = 'FILL'; return c;
}
function recolorDot(i, color) {
  // ConversationListItem's dot is status/running; re-applying the same variable renders black.
  if (color !== 'status/running') i.findOne(n => n.name === 'dot').fills = P(color);
}
async function buildSessionRows() {
  if (findComp('SessionRow')) return;
  const sec = newSection('SessionRow + ConvRow', 'components/sessions/hub/SessionRow.tsx, ConvRow.tsx and tree/DrillRow.tsx — thin wrappers that render ConversationListItem (compact, dot leading). SessionRow and DrillRow color the dot by tier; ConvRow has no tier.');
  const comps = [];
  for (const tier of Object.keys(TIER)) {
    const i = inst('ConversationListItem', 'Layout=Compact'); setInstanceText(i, 'title', 'Fix auth token refresh'); recolorDot(i, TIER[tier][0]);
    comps.push(wrapComp('Tier=' + tier, i));
  }
  simpleSet(comps, sec, 'SessionRow', 900, 'components/sessions/hub/SessionRow.tsx (and tree/DrillRow.tsx, which is identical). <SessionRow session tier lastOutput />. Preview reads "12 prompts" ("1 prompt").');
  const cv = inst('ConversationListItem', 'Layout=Compact'); setInstanceText(cv, 'title', 'Fix auth token refresh');
  const conv = wrapComp('ConvRow', cv); conv.description = 'components/sessions/hub/ConvRow.tsx. <ConvRow conversation forceServerChip />. Server chip only when several servers are active.';
  const set = findComp('SessionRow'); sec.appendChild(conv); conv.x = 40; conv.y = set.y + set.height + 40;
  sec.resizeWithoutConstraints(sec.width, conv.y + conv.height + 40);
}

async function buildMachineBadge() {
  if (findComp('MachineBadge')) return;
  const sec = newSection('MachineBadge', 'components/sessions/MachineBadge.tsx — a Badge with the machine name, text.accent on text.accent @12.5%.');
  const b = inst('Badge', 'Size=sm, Tone=Accent'); setInstanceText(b, 'label', 'MacBook Pro');
  single(wrapComp('MachineBadge', b), sec, 'components/sessions/MachineBadge.tsx. <MachineBadge name />.');
}

async function buildSessionStatusBadge() {
  if (findComp('SessionStatusBadge')) return;
  const sec = newSection('SessionStatusBadge', 'components/sessions/SessionStatusBadge.tsx — row gap 4: LiveDot 7 + 11/500 label in the dot color. Color follows the session status, the label follows the tier (a completed session is status.completed but reads "Resumable"). Refreshing: a 0.6-scale spinner replaces the dot.');
  const comps = [];
  for (const [name, color, label, spin] of [['Working', 'status/running', 'Working'], ['NeedsYou', 'status/waiting', 'Needs you'], ['Resumable', 'status/completed', 'Resumable'], ['CantResume', 'status/failed', 'Can\'t resume'], ['Refreshing', 'status/running', 'Working', true]]) {
    const c = comp('State=' + name, 'HORIZONTAL', { counterAxisAlignItems: 'CENTER', itemSpacing: 4 });
    c.appendChild(spin ? icon('CircleNotch', 10, color) : dot(7, color));
    c.appendChild(await T(label, 'label/xs-medium', color, { name: 'label' }));
    comps.push(c);
  }
  simpleSet(comps, sec, 'SessionStatusBadge', 700, 'components/sessions/SessionStatusBadge.tsx. <SessionStatusBadge status tier refreshing />. The dot pulses when live.');
}

async function buildLiveCardWrappers() {
  if (findComp('NeedsYouCard')) return;
  const sec = newSection('NeedsYouCard + WorkingCard', 'components/sessions/now/NeedsYouCard.tsx and WorkingCard.tsx — LiveCard content. NeedsYou (solid, status.waiting): StateBadge "Needs you · waiting 2m", mono 11/15 output box, footer project · branch + "Open →". Working (faint, status.running): StateBadge "Working · Thinking · 4m" and a 2px sweep with a 34% running bar.');
  const comps = [];
  for (const [v, output] of [['Full', true], ['NoOutput', false]]) {
    const i = inst('LiveCard', 'Kind=NeedsYou'); setInstanceText(i, 'title', 'tb-mobile · feat/auth');
    setInstanceText(i, 'label', 'Needs you · waiting 2m'); setInstanceText(i, 'project', 'ai-tools/tb-mobile'); setInstanceText(i, 'branch', 'feat/auth');
    const tail = i.findOne(n => n.name === 'terminal tail');
    if (output) setInstanceText(i, 'tail', 'Do you want to proceed? ❯ 1. Yes  2. No'); else tail.visible = false;
    comps.push(wrapComp('Variant=' + v, i));
  }
  const set = simpleSet(comps, sec, 'NeedsYouCard', 860, 'components/sessions/now/NeedsYouCard.tsx. <NeedsYouCard session />. Without a branch the "·" goes too.');
  const wc = [];
  for (const [v, label] of [['Phase', 'Working · Thinking · 4m'], ['Elapsed', 'Working · 4m']]) {
    const i = inst('LiveCard', 'Kind=Working'); setInstanceText(i, 'title', 'ledger-api · feat/idempotent-reconciliation'); setInstanceText(i, 'label', label);
    wc.push(wrapComp('Variant=' + v, i));
  }
  const ws = figma.combineAsVariants(wc, sec); ws.name = 'WorkingCard';
  finishSet(ws, sec, 860, 'components/sessions/now/WorkingCard.tsx. <WorkingCard session />. Phases: Thinking, Replying, Running hooks, Acting, Working.');
  ws.y = set.y + set.height + 40;
  sec.resizeWithoutConstraints(sec.width, ws.y + ws.height + 40);
}

async function buildProjectHubCard() {
  if (findComp('ProjectHubCard')) return;
  const sec = newSection('ProjectHubCard', 'components/sessions/hub/ProjectHubCard.tsx — Card (padding 0, clipped): 3px rail in the most urgent live status (transparent when nothing is live). Header padding 12, gap 8: mono 10/500 parent path, 17/600/21 folder, 11 activity line; mono 11 count; CaretRight 16 (90° when open). Open body: 1px top border, rows in 12 / 8 padding, "All 24 conversations" 13 accent + CaretRight 14.');
  const comps = [];
  for (const [state, rail, open, loading] of [['Closed', null, false], ['ClosedWaiting', 'status/waiting', false], ['Open', 'status/waiting', true], ['OpenLoading', null, true, true]]) {
    const c = comp('State=' + state, 'HORIZONTAL', { strokeWeight: 1, clipsContent: true }); rad(c, 'md'); c.fills = P('bg/card'); c.strokes = P('border');
    c.primaryAxisSizingMode = 'FIXED'; c.resize(378, 60); c.counterAxisSizingMode = 'AUTO';
    const r = figma.createRectangle(); r.name = 'rail'; r.resize(3, 60); r.fills = rail ? P(rail) : []; c.appendChild(r); r.layoutSizingVertical = 'FILL';
    const body = AL('VERTICAL', 'body'); c.appendChild(body); body.layoutGrow = 1;
    const head = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER', itemSpacing: 8 }); pad(head, 'md', 'md'); fill(body, head);
    const col = AL('VERTICAL', 'text', { itemSpacing: 2 }); head.appendChild(col); col.layoutGrow = 1;
    col.appendChild(styled(await T('~/dev/ai-tools/', 'mono/xs', 'text/secondary', { name: 'parent' }), null, 10));
    col.appendChild(await T('tb-mobile', 'label/lg', 'text/primary', Object.assign({ name: 'folder' }, lh(21))));
    col.appendChild(await T(rail ? '1 needs you · 3 today · last 2h' : '3 today · last 2h', 'body/xs', 'text/secondary', { name: 'activity' }));
    head.appendChild(await T('8', 'mono/xs', 'text/secondary', { name: 'count' }));
    const chev = iconBox('chevron', 'CaretRight', 16, 'text/secondary', 16); if (open) chev.children[0].rotation = -90; head.appendChild(chev);
    if (open) {
      const ob = AL('VERTICAL', 'open', Object.assign({ paddingBottom: 12 }, { strokeTopWeight: 1, strokeBottomWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 })); ob.strokes = P('border'); fill(body, ob);
      const s = AL('VERTICAL', 'rows'); s.paddingTop = 8; sp(s, 'paddingLeft', 'md'); sp(s, 'paddingRight', 'md'); fill(ob, s);
      if (loading) {
        const sp_ = AL('HORIZONTAL', 'spinner', { paddingTop: 8, paddingBottom: 8 }); sp_.appendChild(icon('CircleNotch', 16, 'text/secondary')); s.appendChild(sp_);
      } else {
        for (const [tier, title] of [['needsYou', 'Fix auth token refresh'], ['working', 'Add offline queue'], ['resumable', 'Refactor theme tokens']]) {
          const row = inst('SessionRow', 'Tier=' + tier); fill(s, row); setInstanceText(row, 'title', title);
        }
        const all = AL('HORIZONTAL', 'see all', { counterAxisAlignItems: 'CENTER', itemSpacing: 4, paddingTop: 4, paddingBottom: 4 }); s.appendChild(all);
        all.appendChild(await T('All 24 conversations', 'body/sm', 'text/accent', { name: 'label' })); all.appendChild(icon('CaretRight', 14, 'text/accent'));
      }
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'ProjectHubCard', 880, 'components/sessions/hub/ProjectHubCard.tsx. <ProjectHubCard project expanded onToggle />. Up to 3 SessionRow / ConvRow; an optional "Browse path" row uses the "see all" style.');
}

async function buildExternalSessionBanner() {
  if (findComp('ExternalSessionBanner')) return;
  const sec = newSection('ExternalSessionBanner', 'components/sessions/ExternalSessionBanner.tsx — row gap 8, padding 8×16, bg-secondary, hairline bottom border. Terminal 16 warning; 13/600 warning title + 11/15 secondary subtitle; "Take over" (padding 4×12, radius 6, hairline warning border, 11/600 warning). Taking over: 50% with a warning spinner.');
  const comps = [];
  for (const state of ['Default', 'TakingOver']) {
    const c = rowComp('State=' + state, 402, HAIR_B); pad(c, 'sm', 'lg'); sp(c, 'itemSpacing', 'sm'); c.fills = P('bg/secondary'); c.strokes = P('border');
    c.appendChild(icon('Terminal', 16, 'text/warning'));
    const col = AL('VERTICAL', 'text', { itemSpacing: 1 }); c.appendChild(col); col.layoutGrow = 1;
    wrapText(col, await T('Launched outside Threadbase', 'label/sm', 'text/warning', { name: 'title' }));
    wrapText(col, await T('Streaming output only — prompts can\'t be answered from here.', 'body/xs', 'text/secondary', Object.assign({ name: 'subtitle' }, lh(15))));
    const b = await button('take over', 'Take over', 'label/xs', 'text/warning', { stroke: ['text/warning'], strokeWeight: 0.5, radius: 6, pv: 4, minHeight: null });
    if (state === 'TakingOver') { b.children[0].visible = false; b.appendChild(icon('CircleNotch', 13, 'text/warning')); b.opacity = 0.5; }
    c.appendChild(b);
    comps.push(c);
  }
  simpleSet(comps, sec, 'ExternalSessionBanner', 900, 'components/sessions/ExternalSessionBanner.tsx. <ExternalSessionBanner onTakeOver busy />. For sessions started in a terminal on the computer.');
}

async function buildServerWarmingBanner() {
  if (findComp('ServerWarmingBanner')) return;
  const sec = newSection('ServerWarmingBanner', 'components/sessions/banners/ServerWarmingBanner.tsx — Card variant="warning" with a row, gap 8: pulsing LiveDot 8 status.waiting, then "Server is warming up" 13/600, server name 11 secondary, "History will appear when indexing finishes." 11 secondary.');
  const ref = findComp('Card').children.find(v => v.name === 'Variant=warning');
  const c = rowComp('ServerWarmingBanner', 370, { itemSpacing: 8 });
  for (const k of ['fills', 'strokes', 'strokeWeight', 'cornerRadius', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight']) c[k] = ref[k];
  c.appendChild(dot(8, 'status/waiting'));
  const col = AL('VERTICAL', 'text', { itemSpacing: 2 }); c.appendChild(col); col.layoutGrow = 1;
  wrapText(col, await T('Server is warming up', 'label/sm', 'text/primary', { name: 'title' }));
  wrapText(col, await T('MacBook Pro', 'body/xs', 'text/secondary', { name: 'server' }));
  wrapText(col, await T('History will appear when indexing finishes.', 'body/xs', 'text/secondary', { name: 'message' }));
  single(c, sec, 'components/sessions/banners/ServerWarmingBanner.tsx. <ServerWarmingBanner serverName />. Card (warning) styling copied from the Card component.');
}

async function buildSessionDetailSlowBanner() {
  if (findComp('SessionDetailSlowBanner')) return;
  await slowBanner('SessionDetailSlowBanner', 'Session details are taking their time…', 'Fetching the details — shouldn\'t be long.', 'components/sessions/SessionDetailSlowBanner.tsx — a Banner with a text.warning accent and spinner, a destructive Cancel action. Same layout as SlowLoadingBanner.');
}

async function buildSyncCachedNotice() {
  if (findComp('SyncCachedNotice')) return;
  const sec = newSection('SyncCachedNotice', 'components/sessions/SyncCachedNotice.tsx — an absolute, touch-through overlay at top 8 wrapping KnightRiderScanner. Banner: centered, banner size. Caption: top 4, 14 from the trailing edge, compact size. Renders nothing when not visible.');
  const comps = [];
  for (const [p, size] of [['Banner', 'Banner'], ['Caption', 'Compact']]) comps.push(wrapComp('Placement=' + p, inst('KnightRiderScanner', 'Size=' + size)));
  simpleSet(comps, sec, 'SyncCachedNotice', 500, 'components/sessions/SyncCachedNotice.tsx. <SyncCachedNotice visible placement="banner|caption" />.');
}

async function radioRow(parent, on, title, hint) {
  const r = AL('HORIZONTAL', 'option', { itemSpacing: 8, paddingTop: 8, paddingBottom: 8, minHeight: 44 }); fill(parent, r);
  r.appendChild(icon(on ? 'RadioButton-fill' : 'Circle', 22, on ? 'text/accent' : 'text/secondary'));
  const col = AL('VERTICAL', 'text', { itemSpacing: 2 }); r.appendChild(col); col.layoutGrow = 1;
  wrapText(col, await T(title, 'label/base', 'text/primary', { name: 'title' }));
  wrapText(col, await T(hint, 'body/sm', 'text/secondary', Object.assign({ name: 'hint' }, lh(18))));
}
async function dialogCard(name, title, lvl) {
  const c = colComp(name, 354, { strokeWeight: 1, cornerRadius: 16 }); pad(c, 'xl', 'xl'); sp(c, 'itemSpacing', 'md'); c.fills = P('bg/card'); c.strokes = P('border');
  const head = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER' }); sp(head, 'itemSpacing', 'sm'); fill(c, head);
  if (lvl) head.appendChild(icon(LEVEL[lvl][0], 20, LEVEL[lvl][1]));
  const t = await T(title, 'label/lg', 'text/primary', { name: 'title' }); head.appendChild(t); t.layoutGrow = 1; t.textAutoResize = 'HEIGHT';
  return c;
}
async function actionRow(parent, actions) {
  const row = AL('HORIZONTAL', 'actions', { paddingTop: 4 }); sp(row, 'itemSpacing', 'sm'); fill(parent, row);
  for (const [label, primary] of actions) {
    const b = await button(label, label, 'label/base', primary ? 'text/onAccent' : 'text/secondary', primary ? { fill: ['text/accent'], radius: 10, pv: 8 } : { stroke: ['border'], radius: 10, pv: 8, weight: 'Medium' });
    row.appendChild(b); b.layoutGrow = 1;
  }
  return row;
}
async function buildLeaveSessionModal() {
  if (findComp('LeaveSessionModal')) return;
  const sec = newSection('LeaveSessionModal', 'components/sessions/LeaveSessionModal.tsx — CriticalDialog (warning) "Leave this session?". Options gap 8: rows padding 8, min 44, gap 8; RadioButton fill 22 accent / Circle 22 secondary; 15/600 title + 13/18 hint. "Don\'t ask me again": CheckSquare fill / Square 22 + 13 primary. Pending: "Sending…" busy, no buttons. Error: single Confirm.');
  const comps = [];
  for (const state of ['Options', 'Pending', 'Error']) {
    const c = await dialogCard('State=' + state, 'Leave this session?', 'Warning');
    if (state === 'Pending') {
      const busy = AL('HORIZONTAL', 'busy', { counterAxisAlignItems: 'CENTER' }); sp(busy, 'itemSpacing', 'sm'); fill(c, busy);
      busy.appendChild(icon('CircleNotch', 20, 'text/accent')); busy.appendChild(await T('Sending…', 'body/sm', 'text/secondary', { name: 'message' }));
    } else {
      const err = state === 'Error';
      wrapText(c, await T(err ? 'Couldn\'t complete this action. Check your connection and try again.' : 'The agent on the computer keeps running until you choose.', 'body/sm', 'text/secondary', Object.assign({ name: 'message' }, lh(20))));
      if (!err) {
        const list = AL('VERTICAL', 'options', { itemSpacing: 8 }); fill(c, list);
        await radioRow(list, false, 'Kill it', 'Stop the session now. History stays if there is one.');
        await radioRow(list, true, 'Leave it', 'Keep it running so you can come back.');
        await radioRow(list, false, 'Kill on idle', 'Don\'t cut a turn in progress; hold when the session is idle.');
        const rem = AL('HORIZONTAL', 'remember', { counterAxisAlignItems: 'CENTER', itemSpacing: 8, minHeight: 44 }); fill(c, rem);
        rem.appendChild(icon('Square', 22, 'text/secondary')); rem.appendChild(await T('Don\'t ask me again', 'body/sm', 'text/primary', { name: 'label' }));
      }
      await actionRow(c, err ? [['Confirm', true]] : [['Cancel', false], ['Confirm', true]]);
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'LeaveSessionModal', 1240, 'components/sessions/LeaveSessionModal.tsx. <LeaveSessionModal visible onConfirm onCancel />. Checked: CheckSquare fill in text.accent.');
}

async function nameInput(parent, value, placeholder) {
  const i = AL('HORIZONTAL', 'input', { strokeWeight: 1, cornerRadius: 10 }); pad(i, 'sm', 'md'); i.fills = P('bg/secondary'); i.strokes = P('border'); fill(parent, i);
  const t = await T(value || placeholder, 'body/base', value ? 'text/primary' : 'text/secondary', { name: 'value' }); i.appendChild(t); t.layoutGrow = 1;
}
async function buildNameSessionModal() {
  if (findComp('NameSessionModal')) return;
  await figma.loadFontAsync({ family: 'Inter', style: 'Italic' });
  const sec = newSection('NameSessionModal', 'components/sessions/NameSessionModal.tsx — centered over rgba(0,0,0,0.6), padding 24. Card bg-card, radius 16, 1px border, padding 24, gap 12: title 17/600, exit-mode hint 13 italic secondary, input (bg-secondary, border, radius 10, padding 8×12, 15), buttons gap 8: Cancel (border, 15/500 secondary) + accent (15/600 onAccent).');
  const comps = [];
  for (const [mode, title, action, value] of [['Create', 'Name this session?', 'Start', null], ['Exit', 'Name this session before you go?', 'Save', 'Fix auth bug in refresh flow']]) {
    const c = await dialogCard('Mode=' + mode, title);
    if (mode === 'Exit') c.appendChild(styled(await T('Current: "Fix auth bug"', 'body/sm', 'text/secondary', { name: 'current' }), 'Italic'));
    await nameInput(c, value, 'e.g. Fix auth bug');
    await actionRow(c, [['Cancel', false], [action, true]]);
    comps.push(c);
  }
  simpleSet(comps, sec, 'NameSessionModal', 900, 'components/sessions/NameSessionModal.tsx. <NameSessionModal mode="create|exit" onSave onCancel />. "Current:" is hardcoded English in code.');
}

async function effortChips(parent, labels, active) {
  const row = AL('HORIZONTAL', 'chips', { layoutWrap: 'WRAP', itemSpacing: 4, counterAxisSpacing: 4 }); fill(parent, row);
  for (const l of labels) {
    const on = l === active;
    const ch = AL('HORIZONTAL', 'chip', { strokeWeight: 1, cornerRadius: 6, paddingTop: 4, paddingBottom: 4 }); sp(ch, 'paddingLeft', 'md'); sp(ch, 'paddingRight', 'md');
    ch.strokes = P(on ? 'text/accent' : 'border'); ch.fills = on ? P('bg/secondary') : [];
    ch.appendChild(on ? await T(l, 'label/sm', 'text/accent', { name: 'label' }) : await T(l, 'body/sm', 'text/secondary', { name: 'label' }));
    row.appendChild(ch);
  }
}
async function buildModelEffortSheet() {
  if (findComp('ModelEffortSheet')) return;
  const sec = newSection('ModelEffortSheet', 'components/sessions/ModelEffortSheet.tsx — centered card (as NameSessionModal), padding 24, gap 8. "Model & effort" 17/600 + 13 secondary. Section labels 15/600 (12 above), "Currently: …" 13 secondary, input, chips (padding 4×12, radius 6, border, 13 secondary; active: accent border, bg-secondary, 13/600 accent). Notices 13 (busy secondary, error danger). Cancel + Apply (50% when disabled).');
  const comps = [];
  for (const state of ['Default', 'Changed', 'Invalid', 'Busy']) {
    const c = await dialogCard('State=' + state, 'Model & effort'); sp(c, 'itemSpacing', 'sm');
    c.appendChild(await T('Applies to this live session only.', 'body/sm', 'text/secondary', { name: 'subtitle' }));
    const label = async (t) => { const l = await T(t, 'label/base', 'text/primary', { name: 'section' }); c.appendChild(l); return l; };
    await label('Model');
    c.appendChild(await T('Currently: claude-sonnet-4-5', 'body/sm', 'text/secondary', { name: 'current' }));
    await nameInput(c, state === 'Invalid' ? 'opus 4.1!' : state === 'Changed' ? 'opus' : null, 'Alias or full model name');
    await effortChips(c, ['sonnet', 'opus', 'haiku'], state === 'Changed' ? 'opus' : state === 'Invalid' ? null : 'sonnet');
    if (state === 'Invalid') c.appendChild(await T('Use letters, digits, dots, dashes or underscores.', 'body/sm', 'text/danger', { name: 'error' }));
    await label('Reasoning effort');
    c.appendChild(await T('Currently: high', 'body/sm', 'text/secondary', { name: 'current' }));
    await effortChips(c, ['low', 'medium', 'high', 'xhigh', 'max'], 'high');
    if (state === 'Busy') wrapText(c, await T('Wait for the current turn to finish, then try again.', 'body/sm', 'text/secondary', { name: 'notice' }));
    const row = await actionRow(c, [['Cancel', false], ['Apply', true]]); row.paddingTop = 12;
    if (state !== 'Changed') row.children[1].opacity = 0.5;
    comps.push(c);
  }
  simpleSet(comps, sec, 'ModelEffortSheet', 1600, 'components/sessions/ModelEffortSheet.tsx. <ModelEffortSheet session onApply onClose />. Errors: "Couldn\'t change the setting.", "This server can\'t change the model for this session.", "This session has no live terminal. Resume it first."');
}

async function buildConversationPreviewSheet() {
  if (findComp('ConversationPreviewSheet')) return;
  const sec = newSection('ConversationPreviewSheet', 'components/sessions/shared/ConversationPreviewSheet.tsx — bottom sheet (60% / 90%), bg-card, border handle. Top: ConversationListItem (compact, no preview) with a 1px bottom border. Messages padding 12×8, gap 8: MessageBubbles, a spinner (24 vertical) or a 13 secondary placeholder. Footer gap 8, padding 8/12/16, 1px top border: accent "Open conversation" (15/600 onAccent) + optional Pin (border, 15/500).');
  const comps = [];
  for (const kind of ['Conversation', 'Loading', 'Empty', 'Session']) {
    const c = await sheet('Kind=' + kind); c.fills = P('bg/card'); c.paddingLeft = c.paddingRight = c.paddingBottom = 0; c.itemSpacing = 0;
    const top = inst('ConversationListItem', 'Layout=Compact'); setInstanceText(top, 'title', 'Fix auth token refresh');
    top.strokes = P('border'); top.strokeBottomWeight = 1; top.strokeTopWeight = top.strokeLeftWeight = top.strokeRightWeight = 0; fill(c, top);
    if (kind === 'Session') recolorDot(top, 'status/waiting');
    const msgs = AL('VERTICAL', 'messages', { itemSpacing: 8, paddingTop: 8, paddingBottom: 8 }); sp(msgs, 'paddingLeft', 'md'); sp(msgs, 'paddingRight', 'md'); fill(c, msgs);
    if (kind === 'Conversation') for (const r of ['Role=User', 'Role=Assistant', 'Role=AssistantCode']) fill(msgs, inst('MessageBubble', r));
    else if (kind === 'Loading') { msgs.paddingTop = msgs.paddingBottom = 24; msgs.appendChild(icon('CircleNotch', 20, 'text/secondary')); }
    else { msgs.counterAxisAlignItems = 'CENTER'; msgs.paddingTop = msgs.paddingBottom = 12;
      wrapText(msgs, await T(kind === 'Empty' ? 'No messages yet.' : 'Live session preview not available — open the session to see the live terminal.', 'body/sm', 'text/secondary', { name: 'placeholder', textAlignHorizontal: 'CENTER' })); }
    const foot = AL('HORIZONTAL', 'footer', Object.assign({ itemSpacing: 8, paddingTop: 8, paddingBottom: 16 }, { strokeTopWeight: 1, strokeBottomWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 }));
    sp(foot, 'paddingLeft', 'md'); sp(foot, 'paddingRight', 'md'); foot.strokes = P('border'); foot.fills = P('bg/card'); fill(c, foot);
    const main = await button('open', kind === 'Session' ? 'Open session' : 'Open conversation', 'label/base', 'text/onAccent', { fill: ['text/accent'], radius: 10, pv: 8, minHeight: null });
    foot.appendChild(main); main.layoutGrow = 1;
    if (kind !== 'Session') foot.appendChild(await button('pin', 'Pin', 'title/base-medium', 'text/primary', { stroke: ['border'], radius: 10, pv: 8, ph: 16, minHeight: null }));
    comps.push(c);
  }
  simpleSet(comps, sec, 'ConversationPreviewSheet', 1780, 'components/sessions/shared/ConversationPreviewSheet.tsx. <ConversationPreviewSheet target onOpen onClose />. Long-press preview; nothing renders when target is null. Pin becomes "Unpin" for a pinned chat.');
}

async function buildRemoteKeyboardControls() {
  if (findComp('RemoteKeyboardControls')) return;
  const sec = newSection('RemoteKeyboardControls', 'components/sessions/RemoteKeyboardControls.tsx — row gap 8, hairline top border, padding top 8. Scrolling keys gap 4: bg-secondary, radius 8, min 48×40, padding 0×8, 15/600 primary. Confirm (open prompt only): accent, radius 8, min 40, padding 0×12, 14/600 onAccent. X 20 secondary in a 32×40 box. Busy: keys at 45%.');
  const comps = [];
  for (const state of ['Default', 'WithConfirm', 'Busy']) {
    const c = rowComp('State=' + state, 402, Object.assign({ itemSpacing: 8, paddingTop: 8 }, LINE_T)); c.strokes = P('border'); c.clipsContent = true;
    const keys = AL('HORIZONTAL', 'keys', { itemSpacing: 4, paddingRight: 4, clipsContent: true }); c.appendChild(keys); keys.layoutGrow = 1;
    if (state === 'WithConfirm') {
      const b = await button('confirm', 'Hold to confirm selected option', 'label/sm', 'text/onAccent', { fill: ['text/accent'], radius: 8, minHeight: 40 });
      styled(b.children[0], null, 14); keys.appendChild(b);
    }
    for (const k of ['Esc', 'Tab', 'Shift Tab', '←', '↑', '↓', '→', 'Enter']) {
      const b = await button('key', k, 'label/base', 'text/primary', { fill: ['bg/secondary'], radius: 8, ph: 8, minHeight: 40 }); b.minWidth = 48; b.strokeWeight = 0;
      if (state === 'Busy') b.opacity = 0.45; keys.appendChild(b);
    }
    c.appendChild(iconBox('close', 'X', 20, 'text/secondary', 32, 40));
    comps.push(c);
  }
  simpleSet(comps, sec, 'RemoteKeyboardControls', 900, 'components/sessions/RemoteKeyboardControls.tsx. <RemoteKeyboardControls onKey onClose busy prompt />. The key row scrolls horizontally.');
}

// ---------- batch 8: misc, review, terminal ----------
const TOP1 = { strokeTopWeight: 1, strokeBottomWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 };
// Mono text styles carry one weight; bold lines load the same family's Bold.
async function monoBold(t) { const f = { family: t.fontName.family, style: 'Bold' }; await figma.loadFontAsync(f); t.fontName = f; return t; }
function holder(parent, name, props) { const h = AL('VERTICAL', name, props); fill(parent, h); return h; }
function topSheet(name) {
  const c = colComp(name, 402, { strokeTopWeight: 1, strokeLeftWeight: 1, strokeRightWeight: 1, strokeBottomWeight: 0, clipsContent: true });
  corners(c, 16, 16, 0, 0); c.fills = P('bg/secondary'); c.strokes = P('border');
  return c;
}
function accentTile(ic, size, w) { const b = iconBox('icon tile', ic, size, 'text/accent', w, w, 6); PA(b, 'fills', 'text/accent', 0.094); return b; }

const DIAG = [['appVersion', '1.8.2'], ['buildNumber', '214'], ['platform', 'ios'], ['osVersion', '18.6'], ['jsEngine', 'hermes'], ['environment', 'production'], ['connectionMode', 'lan'], ['serverCount', '2'], ['anonymousDiagnosticsEnabled', 'false'], ['easChannel', 'production']];
async function buildDiagnosticsPreview() {
  if (findComp('DiagnosticsPreview')) return;
  const sec = newSection('DiagnosticsPreview', 'components/feedback/DiagnosticsPreview.tsx — column gap 4, padding 0 12 8. Intro 11/17 secondary. Toggle min 32, gap 4: 13/500 accent + CaretDown/CaretUp 14 accent. Open: rows box bg-primary, radius 6, 1px border, padding 8, gap 4; key mono 11 secondary, value mono 11 primary, right-aligned.');
  const comps = [];
  for (const state of ['Collapsed', 'Expanded']) {
    const open = state === 'Expanded';
    const c = colComp('State=' + state, 402, { itemSpacing: 4, paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12 }); c.fills = P('bg/secondary');
    wrapText(c, await T('This report may include the app version, build number, platform, OS version, update channel, connection status category, and configured-server count. It will not include prompts, terminal output, source code, credentials, server addresses, or session content.', 'body/xs', 'text/secondary', Object.assign({ name: 'intro' }, lh(17))));
    const tg = AL('HORIZONTAL', 'toggle', { counterAxisAlignItems: 'CENTER', itemSpacing: 4, minHeight: 32 }); c.appendChild(tg);
    tg.appendChild(styled(await T(open ? 'Hide details' : 'See what\'s included', 'body/sm', 'text/accent', { name: 'label' }), 'Medium'));
    tg.appendChild(icon(open ? 'CaretUp' : 'CaretDown', 14, 'text/accent'));
    if (open) {
      const box = AL('VERTICAL', 'rows', { itemSpacing: 4, strokeWeight: 1, cornerRadius: 6 }); pad(box, 'sm', 'sm'); box.fills = P('bg/primary'); box.strokes = P('border'); fill(c, box);
      for (const [k, v] of DIAG) {
        const r = AL('HORIZONTAL', k, { itemSpacing: 8 }); fill(box, r);
        const kt = await T(k, 'mono/xs', 'text/secondary', { name: 'key' }); r.appendChild(kt); kt.layoutGrow = 1;
        r.appendChild(await T(v, 'mono/xs', 'text/primary', { name: 'value', textAlignHorizontal: 'RIGHT' }));
      }
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'DiagnosticsPreview', 900, 'components/feedback/DiagnosticsPreview.tsx. <DiagnosticsPreview report />. Values are sample data.');
}

const REVIEW_FILES = [['src/api/client.ts', 'Edited · +42 / −8'], ['components/Header.tsx', 'Written · +31 / −0'], ['lib/format.ts', 'Edited · +9 / −15'], ['README.md', 'Edited · +4 / −0']];
async function buildReviewSheet() {
  if (findComp('ReviewSheet')) return;
  const sec = newSection('ReviewSheet', 'components/review/ReviewSheet.tsx — pageSheet, bg-primary, padding-top 12. Header 17/700 + X 22 in 44 box. Summary 13 secondary; warnings 11/16 warning. Filter chips gap 4: 1px border, full radius, 4×10, 11 secondary; active bg-secondary, accent border, 11/600 accent. Search radius 10, 1px border. List rows gap 8, 8×12, FileCode 16, path mono 13, meta 11; active row bg-secondary. Diff pane renders DiffViewer. Action bar gap 12, padding 12, 1px top border: CopySimple / PaperPlaneTilt 16 + 13/600 accent.');
  const comps = [];
  for (const state of ['Selected', 'Empty', 'Filtered']) {
    const empty = state === 'Empty', filtered = state === 'Filtered';
    const c = screenComp('State=' + state, P('bg/primary')); c.paddingTop = 12;
    const head = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER', primaryAxisAlignItems: 'SPACE_BETWEEN', paddingLeft: 12, paddingRight: 12, paddingBottom: 8 }); fill(c, head);
    head.appendChild(styled(await T('Review changes', 'label/lg', 'text/primary', { name: 'title' }), 'Bold'));
    head.appendChild(iconBox('close', 'X', 22, 'text/secondary', 44));
    wrapText(holder(c, 'summary', { paddingLeft: 12, paddingRight: 12, paddingBottom: 4 }), await T(empty ? '0 files' : filtered ? '3 files · +55 / −23' : '4 files · +86 / −23', 'body/sm', 'text/secondary', { name: 'summary' }));
    if (filtered) {
      const w = holder(c, 'warnings', { paddingLeft: 12, paddingRight: 12, paddingBottom: 4 });
      for (const s of ['Built from conversation Edit/Write tools — may be incomplete vs real git status.', 'Some diffs are truncated for performance. Copy the handoff packet for desktop review.'])
        wrapText(w, await T(s, 'body/xs', 'text/warning', Object.assign({ name: 'warning' }, lh(16))));
    }
    const chips = AL('HORIZONTAL', 'filters', { itemSpacing: 4, paddingLeft: 12, paddingRight: 12, paddingBottom: 8 }); fill(c, chips);
    for (const l of ['All', 'Edited', 'Written', 'Diff']) {
      const on = l === (filtered ? 'Edited' : 'All');
      chips.appendChild(await button(l, l, on ? 'label/xs' : 'body/xs', on ? 'text/accent' : 'text/secondary', { stroke: [on ? 'text/accent' : 'border'], fill: on ? ['bg/secondary'] : null, radius: 9999, pv: 4, ph: 10, minHeight: null }));
    }
    const inp = AL('HORIZONTAL', 'search', { strokeWeight: 1, cornerRadius: 10 }); pad(inp, 'sm', 'sm'); inp.strokes = P('border');
    fill(holder(c, 'search wrap', { paddingLeft: 12, paddingRight: 12, paddingBottom: 8 }), inp);
    inp.appendChild(await T(filtered ? 'src' : 'Filter files…', 'body/sm', filtered ? 'text/primary' : 'text/secondary', { name: 'value' }));
    const list = AL('VERTICAL', 'list', Object.assign({ clipsContent: true }, LINE_B)); list.strokes = P('border'); fill(c, list); list.layoutGrow = 1;
    if (empty) wrapText(holder(list, 'empty', { paddingTop: 16, paddingBottom: 16, paddingLeft: 16, paddingRight: 16 }), await T('No file changes found in this conversation yet.', 'body/sm', 'text/secondary', { name: 'message' }));
    else for (const [i, [path, meta]] of (filtered ? REVIEW_FILES.filter(f => f[1].startsWith('Edited')) : REVIEW_FILES).entries()) {
      const r = AL('HORIZONTAL', 'row', { counterAxisAlignItems: 'CENTER', itemSpacing: 8, paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12 }); fill(list, r);
      if (i === 0 && state === 'Selected') r.fills = P('bg/secondary');
      r.appendChild(icon('FileCode', 16, 'text/secondary'));
      const col = AL('VERTICAL', 'text', { itemSpacing: 2 }); r.appendChild(col); col.layoutGrow = 1;
      col.appendChild(await T(path, 'mono/sm', 'text/primary', { name: 'path' }));
      col.appendChild(await T(meta, 'body/xs', 'text/secondary', { name: 'meta' }));
    }
    const diff = AL('VERTICAL', 'diff', { paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8, clipsContent: true }); fill(c, diff); diff.layoutGrow = 1;
    if (state === 'Selected') fill(diff, inst('DiffViewer', 'State=Expanded'));
    else wrapText(holder(diff, 'placeholder', { paddingTop: 16, paddingBottom: 16, paddingLeft: 16, paddingRight: 16 }), await T('Select a file to view its diff.', 'body/sm', 'text/secondary', { name: 'message' }));
    const acts = AL('HORIZONTAL', 'actions', Object.assign({ itemSpacing: 12, paddingTop: 12, paddingBottom: 12, paddingLeft: 12, paddingRight: 12 }, TOP1)); acts.strokes = P('border'); fill(c, acts);
    for (const [ic, l] of [['CopySimple', 'Copy for desktop'], ['PaperPlaneTilt', 'Send note to agent']]) {
      const b = AL('HORIZONTAL', l, { itemSpacing: 6, counterAxisAlignItems: 'CENTER' }); acts.appendChild(b);
      b.appendChild(icon(ic, 16, 'text/accent')); b.appendChild(await T(l, 'label/sm', 'text/accent', { name: 'label' }));
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'ReviewSheet', 1400, 'components/review/ReviewSheet.tsx. <ReviewSheet visible changes onClose onSendNote />. "Send note to agent" shows only when a note can be sent. File paths are sample data.');
}

async function timeFields(parent) {
  const g = AL('HORIZONTAL', 'fields', { counterAxisAlignItems: 'CENTER', itemSpacing: 4 }); parent.appendChild(g); g.layoutGrow = 1;
  for (const [l, v] of [['From', '22:00'], ['To', '07:00']]) {
    g.appendChild(await T(l, 'body/xs', 'text/secondary', { name: 'label' }));
    const b = await button('time', v, 'body/sm', 'text/primary', { stroke: ['border'], radius: 6, pv: 4, ph: 8, minHeight: null }); g.appendChild(b); b.minWidth = 56;
  }
}
async function qhRow(parent, label, style, v, h) {
  const r = AL('HORIZONTAL', label, Object.assign({ counterAxisAlignItems: 'CENTER', itemSpacing: 8, minHeight: 44, paddingTop: v, paddingBottom: v, paddingLeft: h, paddingRight: h }, HAIR_B)); r.strokes = P('border'); fill(parent, r);
  r.appendChild(await T(label, style, 'text/primary', { name: 'label' }));
  return r;
}
async function buildQuietHoursEditor() {
  if (findComp('QuietHoursEditor')) return;
  const sec = newSection('QuietHoursEditor', 'components/settings/QuietHoursEditor.tsx — rows padding 12, min 44, gap 8, hairline bottom border. "Every day": 15 label + From/To (11 secondary) time fields (13, min 56, 4×8, 1px border, radius 6). "Set hours by day": Show / Hide 13 secondary. Day rows 8×12: 13 label (min 56), fields or "Off", native Switch (accent / border track, white thumb).');
  const comps = [];
  for (const state of ['Collapsed', 'Expanded', 'WeekendOff']) {
    const c = colComp('State=' + state, 402); c.fills = P('bg/secondary');
    await timeFields(await qhRow(c, 'Every day', 'body/base', 12, 12));
    const r2 = await qhRow(c, 'Set hours by day', 'body/base', 12, 12);
    const v = await T(state === 'Collapsed' ? 'Show' : 'Hide', 'body/sm', 'text/secondary', { name: 'value', textAlignHorizontal: 'RIGHT' }); r2.appendChild(v); v.layoutGrow = 1;
    if (state !== 'Collapsed') for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      const off = state === 'WeekendOff' && (d === 'Sat' || d === 'Sun');
      const r = await qhRow(c, d, 'body/sm', 8, 12);
      const dl = r.children[0]; dl.textAutoResize = 'HEIGHT'; dl.resize(56, dl.height);
      if (off) { const o = await T('Off', 'body/sm', 'text/secondary', { name: 'value' }); r.appendChild(o); o.layoutGrow = 1; }
      else await timeFields(r);
      r.appendChild(switchNode(!off));
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'QuietHoursEditor', 1400, 'components/settings/QuietHoursEditor.tsx. <QuietHoursEditor value onChange />.');
}

const SLASH = [['Trash', 'clear', 'Clear conversation history and free context'], ['Stack', 'compact', 'Compress context with a summary to save tokens'], ['CheckCircle', 'review', 'Review recent changes and provide feedback'], ['Pulse', 'status', 'Show current session status and context usage'], ['Sparkle', 'model', 'Switch the active Claude model for this session', true]];
async function buildSlashCommandBoard() {
  if (findComp('SlashCommandBoard')) return;
  const sec = newSection('SlashCommandBoard', 'components/shared/SlashCommandBoard.tsx — bottom sheet above the keyboard over a rgba(0,0,0,0.35) backdrop: bg-secondary, top radius 16, 1px border top/sides, max 55%. Header 8×16, 1px bottom: Terminal 15 accent + "COMMANDS" 11/600 +0.5; query badge mono 11 accent on accent 9.4%, radius 6. Rows min 56, 8×16, gap 12, hairline: 34 tile (accent 9.4%, icon 18), "/" mono 15/600 accent + id 15/600, optional "args" badge 11 warning, description 13 secondary, CaretRight 14.');
  const comps = [];
  for (const state of ['List', 'Filtered', 'Empty']) {
    const c = topSheet('State=' + state);
    const head = AL('HORIZONTAL', 'header', Object.assign({ counterAxisAlignItems: 'CENTER', primaryAxisAlignItems: 'SPACE_BETWEEN', paddingTop: 8, paddingBottom: 8, paddingLeft: 16, paddingRight: 16 }, LINE_B)); head.strokes = P('border'); fill(c, head);
    const left = AL('HORIZONTAL', 'title', { itemSpacing: 4, counterAxisAlignItems: 'CENTER' }); head.appendChild(left);
    left.appendChild(icon('Terminal', 15, 'text/accent')); left.appendChild(upper(await T('Commands', 'label/xs', 'text/secondary', { name: 'title' }), 0.5));
    if (state !== 'List') {
      const q = AL('HORIZONTAL', 'query', { paddingTop: 2, paddingBottom: 2, paddingLeft: 8, paddingRight: 8, cornerRadius: 6 }); PA(q, 'fills', 'text/accent', 0.094); head.appendChild(q);
      q.appendChild(await T(state === 'Empty' ? '/xyz' : '/c', 'mono/xs', 'text/accent', { name: 'query' }));
    }
    for (const [ic, id, desc, args] of state === 'List' ? SLASH : state === 'Filtered' ? SLASH.filter(s => s[1].startsWith('c')) : []) {
      const r = AL('HORIZONTAL', id, Object.assign({ counterAxisAlignItems: 'CENTER', itemSpacing: 12, minHeight: 56, paddingTop: 8, paddingBottom: 8, paddingLeft: 16, paddingRight: 16 }, HAIR_B)); r.strokes = P('border'); fill(c, r);
      r.appendChild(accentTile(ic, 18, 34));
      const body = AL('VERTICAL', 'body', { itemSpacing: 2 }); r.appendChild(body); body.layoutGrow = 1;
      const tl = AL('HORIZONTAL', 'title', { itemSpacing: 1, counterAxisAlignItems: 'CENTER' }); body.appendChild(tl);
      tl.appendChild(await monoBold(await T('/', 'mono/sm', 'text/accent', { name: 'slash', fontSize: 15 })));
      tl.appendChild(await T(id, 'label/base', 'text/primary', { name: 'id' }));
      if (args) {
        const b = AL('HORIZONTAL', 'args', { paddingTop: 1, paddingBottom: 1, paddingLeft: 4, paddingRight: 4, cornerRadius: 6 }); PA(b, 'fills', 'text/warning', 0.094);
        b.appendChild(await T('args', 'body/xs', 'text/warning', { name: 'label' })); tl.appendChild(b); tl.itemSpacing = 4;
      }
      const d = await T(desc, 'body/sm', 'text/secondary', { name: 'description', textTruncation: 'ENDING', maxLines: 1 }); body.appendChild(d); d.layoutSizingHorizontal = 'FILL';
      r.appendChild(icon('CaretRight', 14, 'text/secondary'));
    }
    if (state === 'Empty') { const e = holder(c, 'empty', { counterAxisAlignItems: 'CENTER', paddingTop: 24, paddingBottom: 24, paddingLeft: 24, paddingRight: 24 }); e.appendChild(await T('No commands match "/xyz"', 'body/sm', 'text/secondary', { name: 'message' })); }
    comps.push(c);
  }
  simpleSet(comps, sec, 'SlashCommandBoard', 1400, 'components/shared/SlashCommandBoard.tsx. <SlashCommandBoard query commands onPick onClose />. Commands come from constants/slashCommands.ts.');
}

async function buildSlashCommandArgModal() {
  if (findComp('SlashCommandArgModal')) return;
  const sec = newSection('SlashCommandArgModal', 'components/shared/SlashCommandArgModal.tsx — bottom sheet over rgba(0,0,0,0.5): bg-secondary (GlassFill in glass themes), top radius 16, 1px border top/sides, gap 12, padding-bottom 24. Header 16/16/8, 1px bottom: 36 tile (Sparkle 18 accent on accent 9.4%), "/model" mono 15/700 accent + 13 secondary description, X 20. "MODEL NAME" 11/600 +0.5; input bg-card, radius 10, 1px border, min 44, 15. Cancel flex 1 (bg-card, border, 15 secondary) + Run flex 2 (accent, PaperPlaneRight 15 white, 15/600 onAccent; 40% while empty).');
  const comps = [];
  for (const state of ['Empty', 'Filled']) {
    const filled = state === 'Filled';
    const c = topSheet('State=' + state); c.paddingBottom = 24; c.itemSpacing = 12;
    const head = AL('HORIZONTAL', 'header', Object.assign({ counterAxisAlignItems: 'CENTER', itemSpacing: 12, paddingTop: 16, paddingBottom: 8, paddingLeft: 16, paddingRight: 16 }, LINE_B)); head.strokes = P('border'); fill(c, head);
    head.appendChild(accentTile('Sparkle', 18, 36));
    const col = AL('VERTICAL', 'text', { itemSpacing: 1 }); head.appendChild(col); col.layoutGrow = 1;
    col.appendChild(await monoBold(await T('/model', 'mono/sm', 'text/accent', { name: 'command', fontSize: 15 })));
    const d = await T('Switch the active Claude model for this session', 'body/sm', 'text/secondary', { name: 'description', textTruncation: 'ENDING', maxLines: 1 }); col.appendChild(d); d.layoutSizingHorizontal = 'FILL';
    head.appendChild(icon('X', 20, 'text/secondary'));
    const body = holder(c, 'body', { itemSpacing: 4, paddingLeft: 16, paddingRight: 16 });
    body.appendChild(upper(await T('Model name', 'label/xs', 'text/secondary', { name: 'label' }), 0.5));
    const inp = AL('HORIZONTAL', 'input', { strokeWeight: 1, cornerRadius: 10, minHeight: 44, counterAxisAlignItems: 'CENTER' }); pad(inp, 'sm', 'sm'); inp.fills = P('bg/card'); inp.strokes = P('border'); fill(body, inp);
    const v = await T(filled ? 'claude-opus-4-5' : 'e.g. claude-opus-4-5, claude-sonnet-4-5…', 'body/base', filled ? 'text/primary' : 'text/secondary', { name: 'value' }); inp.appendChild(v); v.layoutGrow = 1;
    const acts = AL('HORIZONTAL', 'actions', { itemSpacing: 8, paddingLeft: 16, paddingRight: 16 }); fill(c, acts);
    const cancel = await button('cancel', 'Cancel', 'body/base', 'text/secondary', { fill: ['bg/card'], stroke: ['border'], radius: 10 }); acts.appendChild(cancel);
    cancel.primaryAxisSizingMode = 'FIXED'; cancel.resize(118, cancel.height);
    const ok = await button('confirm', 'Run /model', 'label/base', 'text/onAccent', { fill: ['text/accent'], radius: 10 }); ok.insertChild(0, icon('PaperPlaneRight', 15, WHITE)); acts.appendChild(ok); ok.layoutGrow = 1;
    if (!filled) ok.opacity = 0.4;
    comps.push(c);
  }
  simpleSet(comps, sec, 'SlashCommandArgModal', 900, 'components/shared/SlashCommandArgModal.tsx. <SlashCommandArgModal command onRun onClose />. Glass themes swap the bg for GlassFill.');
}

async function buildTourOverlay() {
  if (findComp('TourOverlay')) return;
  const sec = newSection('TourOverlay', 'components/tour/TourOverlay.tsx — hard-coded literals. Four rgba(0,0,0,0.72) strips around the target + 8 (square hole). Tooltip left/right 16, 12 below the hole, flips above when there is no room: #161f2e, 1px #2a3650, radius 12, padding 14. Step Menlo 10/600 +0.5 #8b949e; body 14/21 #e6edf3; "Skip tour" Menlo 11/500 #8b949e; "Got it →" Menlo 12/600 white on #3b82f6, radius 6, 6×12.');
  const comps = [];
  for (const place of ['Below', 'Above']) {
    const c = figma.createComponent(); c.name = 'Placement=' + place; c.resize(402, 520); c.fills = hex('#0d1117'); c.clipsContent = true;
    const ty = place === 'Below' ? 120 : 380;
    const tgt = bar('target', 370, 56, hex('#21262d'), 10); c.appendChild(tgt); tgt.x = 16; tgt.y = ty;
    const hy = ty - 8, hh = 72;
    for (const [n, x, y, w, h] of [['top', 0, 0, 402, hy], ['bottom', 0, hy + hh, 402, 520 - hy - hh], ['left', 0, hy, 8, hh], ['right', 394, hy, 8, hh]]) {
      const r = bar('scrim ' + n, w, h, [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0.72 }], 0); c.appendChild(r); r.x = x; r.y = y;
    }
    const card = AL('VERTICAL', 'tooltip', { cornerRadius: 12, strokeWeight: 1, itemSpacing: 6, paddingTop: 14, paddingBottom: 14, paddingLeft: 14, paddingRight: 14 }); card.fills = hex('#161f2e'); card.strokes = hex('#2a3650'); c.appendChild(card);
    card.counterAxisSizingMode = 'FIXED'; card.resize(370, 40); card.primaryAxisSizingMode = 'AUTO';
    if (place === 'Below') card.appendChild(await monoBold(upper(await T('Step 2 of 5', 'mono/xs', hex('#8b949e'), { name: 'step', fontSize: 10 }), 0.5)));
    const body = rawText('Tap here to start a new session on any paired machine.', 14, 'Regular', hex('#e6edf3')); body.name = 'body'; body.lineHeight = { unit: 'PIXELS', value: 21 }; wrapText(card, body);
    const acts = AL('HORIZONTAL', 'actions', { primaryAxisAlignItems: 'SPACE_BETWEEN', counterAxisAlignItems: 'CENTER', paddingTop: 6 }); fill(card, acts);
    acts.appendChild(await T('Skip tour', 'mono/xs', hex('#8b949e'), { name: 'skip' }));
    const btn = AL('HORIZONTAL', 'got it', { cornerRadius: 6, paddingTop: 6, paddingBottom: 6, paddingLeft: 12, paddingRight: 12 }); btn.fills = hex('#3b82f6'); acts.appendChild(btn);
    btn.appendChild(await monoBold(await T('Got it →', 'mono/xs', WHITE, { name: 'label', fontSize: 12 })));
    card.x = 16; card.y = place === 'Below' ? hy + hh + 12 : hy - 12 - card.height;
    comps.push(c);
  }
  simpleSet(comps, sec, 'TourOverlay', 900, 'components/tour/TourOverlay.tsx. <TourOverlay step target onNext onSkip />. Fixed dark colors in every theme; "Skip tour" and "Got it →" are not translated yet.');
}

async function buildConversationSearchView() {
  if (findComp('ConversationSearchView')) return;
  const sec = newSection('ConversationSearchView', 'components/conversation/ConversationSearchView.tsx — match bar only (the list below is ConversationHistoryList with highlighted MessageItems). 8×12, bg-card, 1px bottom border. Count 13/600 secondary ("3 of 1000+" when capped); 32 boxes gap 8: CaretUp / CaretDown bold 18 primary, X bold 18 secondary.');
  const comps = [];
  for (const state of ['Default', 'Capped']) {
    const c = rowComp('State=' + state, 402, Object.assign({ primaryAxisAlignItems: 'SPACE_BETWEEN', paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12 }, LINE_B)); c.fills = P('bg/card'); c.strokes = P('border');
    c.appendChild(await T(state === 'Capped' ? '3 of 1000+' : '3 of 12', 'label/sm', 'text/secondary', { name: 'count' }));
    const g = AL('HORIZONTAL', 'buttons', { itemSpacing: 8 }); c.appendChild(g);
    for (const [n, ic, col] of [['previous', 'CaretUp-bold', 'text/primary'], ['next', 'CaretDown-bold', 'text/primary'], ['close', 'X-bold', 'text/secondary']]) g.appendChild(iconBox(n, ic, 18, col, 32));
    comps.push(c);
  }
  simpleSet(comps, sec, 'ConversationSearchView', 900, 'components/conversation/ConversationSearchView.tsx. <ConversationSearchView query messages onClose />.');
}

async function buildSessionHistoryFeed() {
  if (findComp('SessionHistoryFeed')) return;
  const sec = newSection('SessionHistoryFeed', 'components/terminal/SessionHistoryFeed.tsx — 1px bottom border; collapsed = header only, mini = 35% height, full = flex 1. Header 8×12, gap 8: "History · N messages" 11/600 +0.4 secondary; icon buttons padding 4, secondary: CaretDown bold 14 (collapsed); MagnifyingGlass 16, CaretUp bold 14, ArrowsOut 16 (mini); MagnifyingGlass, ArrowsIn (full). Active search: rgba(88,166,255,0.12), radius 8, primary icon. Search bar 8×16: bg-card input, radius 8, 1px border, 15.');
  const comps = [];
  for (const mode of ['Collapsed', 'Mini', 'Full']) {
    const c = colComp('Mode=' + mode, 402, Object.assign({ clipsContent: true }, LINE_B)); c.fills = P('bg/primary'); c.strokes = P('border');
    const head = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER', primaryAxisAlignItems: 'SPACE_BETWEEN', itemSpacing: 8, paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12 }); fill(c, head);
    const lbl = await T('History · 148 messages', 'label/xs', 'text/secondary', { name: 'label' }); lbl.letterSpacing = { unit: 'PIXELS', value: 0.4 }; head.appendChild(lbl);
    const tr = AL('HORIZONTAL', 'trailing', { itemSpacing: 8, counterAxisAlignItems: 'CENTER' }); head.appendChild(tr);
    const btns = mode === 'Collapsed' ? [['CaretDown-bold', 14]] : mode === 'Mini' ? [['MagnifyingGlass', 16], ['CaretUp-bold', 14], ['ArrowsOut', 16]] : [['MagnifyingGlass', 16, true], ['ArrowsIn', 16]];
    for (const [ic, s, on] of btns) {
      const b = AL('HORIZONTAL', ic, { paddingTop: 4, paddingBottom: 4, paddingLeft: 4, paddingRight: 4, cornerRadius: 8 }); tr.appendChild(b);
      if (on) b.fills = hex('#58a6ff', 0.12);
      b.appendChild(icon(ic, s, on ? 'text/primary' : 'text/secondary'));
    }
    if (mode === 'Collapsed') { comps.push(c); continue; }
    if (mode === 'Full') {
      const sb = AL('HORIZONTAL', 'search bar', Object.assign({ paddingTop: 8, paddingBottom: 8, paddingLeft: 16, paddingRight: 16 }, LINE_B)); sb.strokes = P('border'); fill(c, sb);
      const inp = AL('HORIZONTAL', 'input', { strokeWeight: 1, cornerRadius: 8, paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12 }); inp.fills = P('bg/card'); inp.strokes = P('border'); fill(sb, inp);
      inp.appendChild(await T('refresh', 'body/base', 'text/primary', { name: 'value' }));
      fill(c, inst('ConversationSearchView', 'State=Default'));
    }
    const list = AL('VERTICAL', 'messages', { itemSpacing: 8, paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12, clipsContent: true }); fill(c, list);
    for (const r of ['Role=User', 'Role=Assistant', 'Role=AssistantCode']) fill(list, inst('MessageBubble', r));
    c.primaryAxisSizingMode = 'FIXED'; c.resize(402, mode === 'Mini' ? 306 : 640); list.layoutGrow = 1;
    comps.push(c);
  }
  simpleSet(comps, sec, 'SessionHistoryFeed', 1400, 'components/terminal/SessionHistoryFeed.tsx. <SessionHistoryFeed mode onModeChange messages />. The list header is HistoryLoadBoundary; an active search swaps the list for ConversationSearchView. The active search button uses a literal accent.');
}

// The mono font has no ⏺ (Claude Code's bullet), so the sample uses ●.
const TERM = [['❯ fix the flaky auth test', true], ['● Reading tests/auth.test.ts…'], ['  ⎿  Read 142 lines'], ['● Update(src/auth/session.ts)'], ['  ⎿  Updated with 3 additions and 1 removal'], ['● Bash(npm test -- auth)'], ['  ⎿  PASS tests/auth.test.ts (12 tests)'], ['✻ Done — the race was in token refresh.']];
async function termPill(parent, label) {
  const p = AL('HORIZONTAL', label, { counterAxisAlignItems: 'CENTER', minHeight: 44, cornerRadius: 20, strokeWeight: 1, paddingTop: 6, paddingBottom: 6, paddingLeft: 14, paddingRight: 14 });
  p.fills = hex('#1f6feb', 0.18); p.strokes = hex('#58a6ff', 0.25); parent.appendChild(p); p.layoutPositioning = 'ABSOLUTE';
  p.appendChild(await T(label, 'label/xs-medium', hex('#ffffff', 0.7), { name: 'label', fontSize: 12 }));
  return p;
}
async function buildTerminalOutput() {
  if (findComp('TerminalOutput')) return;
  const sec = newSection('TerminalOutput', 'components/terminal/TerminalOutput.tsx — hard-coded literals. #0d1117, radius 12, 1px #21262d, list padding 8×4. Lines 1×8, mono 12/18 #e6edf3; typed lines (❯ › >) #58a6ff 600. Resumed notice: #21262d, 1px #30363d, radius 8, 10×12, 12/16 #8b949e with #58a6ff/500 links. Jump pills "↑ Top" / "↓ Bottom" 12 from the edges: rgba(31,111,235,0.18), 1px rgba(88,166,255,0.25), radius 20, 6×14, min 44, 12/500 white 70%. QuestionCard renders below when a question is active.');
  const comps = [];
  for (const state of ['Stream', 'ScrolledUp', 'Resumed']) {
    const c = colComp('State=' + state, 402, { cornerRadius: 12, strokeWeight: 1, clipsContent: true }); c.fills = hex('#0d1117'); c.strokes = hex('#21262d');
    const list = holder(c, 'lines', { paddingTop: 8, paddingBottom: 8, paddingLeft: 4, paddingRight: 4 });
    if (state === 'Resumed') {
      const n = AL('VERTICAL', 'resumed notice', { itemSpacing: 4, cornerRadius: 8, strokeWeight: 1, paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12 }); n.fills = hex('#21262d'); n.strokes = hex('#30363d');
      fill(holder(list, 'notice wrap', { paddingLeft: 4, paddingRight: 4, paddingBottom: 8 }), n);
      const l1 = rawText('Earlier output isn\'t available for a resumed session.', 12, 'Regular', hex('#8b949e')); l1.lineHeight = { unit: 'PIXELS', value: 16 }; wrapText(n, l1);
      const s = 'View or search in the conversation history →';
      const l2 = rawText(s, 12, 'Regular', hex('#8b949e')); l2.lineHeight = { unit: 'PIXELS', value: 16 }; wrapText(n, l2);
      for (const w of ['View', 'search', 'the conversation history →']) { const i = s.indexOf(w); l2.setRangeFills(i, i + w.length, hex('#58a6ff')); l2.setRangeFontName(i, i + w.length, { family: 'Inter', style: 'Medium' }); }
    }
    for (const [text, user] of state === 'ScrolledUp' ? TERM.concat(TERM) : TERM) {
      const r = holder(list, 'line', { paddingTop: 1, paddingBottom: 1, paddingLeft: 8, paddingRight: 8, cornerRadius: 3 });
      const t = await T(text, 'mono/xs', hex(user ? '#58a6ff' : '#e6edf3'), Object.assign({ name: 'text', fontSize: 12 }, lh(18))); wrapText(r, t);
      if (user) await monoBold(t);
    }
    if (state === 'Resumed') fill(c, inst('QuestionCard', 'Kind=Permission'));
    if (state === 'ScrolledUp') {
      const top = await termPill(c, '↑ Top'), bottom = await termPill(c, '↓ Bottom');
      top.x = (402 - top.width) / 2; top.y = 12; bottom.x = (402 - bottom.width) / 2; bottom.y = c.height - 12 - bottom.height;
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'TerminalOutput', 1400, 'components/terminal/TerminalOutput.tsx. <TerminalOutput lines question onAnswer resumed />. Fixed dark colors in every theme; lines are sample output.');
}

async function errorButton(parent, label, fills, stroke) {
  const b = AL('HORIZONTAL', 'button', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', minHeight: 44, cornerRadius: 8, strokeWeight: 1, paddingTop: 12, paddingBottom: 12, paddingLeft: 28, paddingRight: 28 });
  b.fills = fills; if (stroke) b.strokes = hex(stroke); parent.appendChild(b);
  const t = rawText(label, 16, 'Semi Bold', hex(fills.length ? '#ffffff' : '#e6edf3')); t.name = 'label'; b.appendChild(t);
  return b;
}
async function buildRootErrorBoundary() {
  if (findComp('RootErrorBoundary')) return;
  const sec = newSection('RootErrorBoundary', 'components/RootErrorBoundary.tsx fallback — hard-coded literals. Full screen #0d1117, centered, padding-x 32, gap 12. Title 20/600 #e6edf3; message 15/22 #8b949e. Reload: #238636, 12×28, radius 8, min 44, 16/600 white. When diagnostics are off: consent checkbox (20, radius 4, 1.5px #30363d; checked #238636) + 14 #e6edf3 label, and an outlined Report button (1px #30363d; #238636 once sent).');
  const comps = [];
  for (const state of ['Reload', 'Report', 'Sent']) {
    const c = screenComp('State=' + state, hex('#0d1117')); c.primaryAxisAlignItems = 'CENTER'; c.counterAxisAlignItems = 'CENTER'; c.paddingLeft = c.paddingRight = 32; c.itemSpacing = 12;
    const title = rawText('Something crashed', 20, 'Semi Bold', hex('#e6edf3')); title.name = 'title'; title.textAlignHorizontal = 'CENTER'; wrapText(c, title);
    const msg = rawText('The app hit an unexpected error. Reloading usually fixes it.', 15, 'Regular', hex('#8b949e')); msg.name = 'message'; msg.textAlignHorizontal = 'CENTER'; msg.lineHeight = { unit: 'PIXELS', value: 22 }; wrapText(c, msg);
    const rw = AL('VERTICAL', 'reload wrap', { paddingTop: 12, counterAxisAlignItems: 'CENTER' }); c.appendChild(rw);
    await errorButton(rw, 'Reload Threadbase', hex('#238636'));
    if (state !== 'Reload') {
      const sent = state === 'Sent';
      const row = AL('HORIZONTAL', 'consent', { itemSpacing: 10, minHeight: 44, counterAxisAlignItems: 'CENTER', paddingTop: 4 }); fill(c, row);
      const box = AL('HORIZONTAL', 'checkbox', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', cornerRadius: 4, strokeWeight: 1.5 }); box.primaryAxisSizingMode = box.counterAxisSizingMode = 'FIXED'; box.resize(20, 20);
      box.strokes = hex(sent ? '#238636' : '#30363d'); if (sent) { box.fills = hex('#238636'); box.appendChild(icon('Check-bold', 14, WHITE)); } row.appendChild(box);
      const l = rawText('Automatically send future crash reports and diagnostics', 14, 'Regular', hex('#e6edf3')); l.name = 'label'; row.appendChild(l); l.layoutGrow = 1; l.textAutoResize = 'HEIGHT';
      await errorButton(c, sent ? 'Report sent. Thank you.' : 'Report this crash', [], sent ? '#238636' : '#30363d');
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'RootErrorBoundary', 1400, 'components/RootErrorBoundary.tsx fallback. Report label also reads "Sending report…" and "Couldn\'t send the report. Please try again.". Fixed dark colors in every theme.');
}

async function buildRenderErrorBoundary() {
  if (findComp('RenderErrorBoundary')) return;
  const sec = newSection('RenderErrorBoundary', 'components/RenderErrorBoundary.tsx fallback — hard-coded literals. Inline card mx 12, my 4, padding 12, radius 8, 1px #30363d, #161b22, gap 4. Title 13/600 #e6edf3; body 11 #8b949e; optional raw preview mono 11 #8b949e (up to 6 lines); "Retry" 13/500 #58a6ff.');
  const comps = [];
  for (const state of ['RawPreview', 'NoPreview']) {
    const c = colComp('State=' + state, 402, { paddingTop: 4, paddingBottom: 4, paddingLeft: 12, paddingRight: 12 }); c.fills = P('bg/primary');
    const card = AL('VERTICAL', 'card', { itemSpacing: 4, cornerRadius: 8, strokeWeight: 1, paddingTop: 12, paddingBottom: 12, paddingLeft: 12, paddingRight: 12 }); card.fills = hex('#161b22'); card.strokes = hex('#30363d'); fill(c, card);
    const t = rawText('Couldn’t render this item', 13, 'Semi Bold', hex('#e6edf3')); t.name = 'title'; wrapText(card, t);
    const b = rawText('Showing a raw fallback instead of crashing the screen.', 11, 'Regular', hex('#8b949e')); b.name = 'body'; wrapText(card, b);
    if (state === 'RawPreview') wrapText(holder(card, 'raw', { paddingTop: 4 }), await T('assistant', 'mono/xs', hex('#8b949e'), { name: 'raw' }));
    const r = rawText('Retry', 13, 'Medium', hex('#58a6ff')); r.name = 'retry'; holder(card, 'retry wrap', { paddingTop: 8, paddingBottom: 4 }).appendChild(r);
    comps.push(c);
  }
  simpleSet(comps, sec, 'RenderErrorBoundary', 900, 'components/RenderErrorBoundary.tsx fallback. Wraps each message row; fixed dark colors in every theme.');
}

// ---------- batch 9: onboarding (components/onboarding, its own literal palette) ----------
const OB = { ink0: '#04070b', ink1: '#070b11', ink2: '#0b1220', ink3: '#0f1a2c', ink5: '#1a2d47', ink6: '#243a59', fg0: '#f4f7fb', fg1: '#d6e0ee', fg2: '#9fb0c8', fg3: '#6c809b', fg4: '#4a5b76', blue4: '#63b3ff', blue5: '#4a9ef0', amber: '#f08a24', green4: '#4ade80', green5: '#16a34a', red: '#ff6b6b', onBlue: '#0a1424' };
function ob(k, a) { return hex(OB[k], a); }
function sans(chars, size, weight, color, o) {
  const t = rawText(chars, size, weight, ob(color)); o = o || {};
  if (o.lh) t.lineHeight = { unit: 'PIXELS', value: o.lh };
  if (o.ls) t.letterSpacing = { unit: 'PIXELS', value: o.ls };
  if (o.center) t.textAlignHorizontal = 'CENTER';
  if (o.name) t.name = o.name;
  return t;
}
async function mono(chars, size, color, o) {
  o = o || {};
  const t = await T(chars, 'mono/xs', ob(color), { name: o.name || 'text', fontSize: size });
  if (o.lh) t.lineHeight = { unit: 'PIXELS', value: o.lh };
  if (o.ls) t.letterSpacing = { unit: 'PIXELS', value: o.ls };
  if (o.upper) t.textCase = 'UPPER';
  if (o.bold) await monoBold(t);
  return t;
}
function vsp(parent, h) { const s = AL('VERTICAL', 'gap ' + h); s.primaryAxisSizingMode = 'FIXED'; s.resize(1, h); parent.appendChild(s); return s; }
function flexSpacer(parent) { const s = AL('VERTICAL', 'flex spacer'); parent.appendChild(s); s.layoutGrow = 1; return s; }
function svgNode(svg, name) { const n = figma.createNodeFromSvg(svg); n.name = name; n.fills = []; return n; }
function obShadow(n, color, a, y, blur) { n.effects = [{ type: 'DROP_SHADOW', color: Object.assign({}, ob(color)[0].color, { a: a }), offset: { x: 0, y: y }, radius: blur, spread: 0, visible: true, blendMode: 'NORMAL' }]; }
// The plugin cannot read assets/icon.png, so this is a placeholder until a bridge job puts the image in.
function ensureAppIcon() {
  if (findComp('Asset/AppIcon')) return;
  const c = figma.createComponent(); c.name = 'Asset/AppIcon'; c.resize(96, 96); c.fills = ob('ink3'); c.description = 'assets/icon.png (app icon).';
  const row = compPage.findOne(n => n.type === 'FRAME' && n.name === 'icons'); if (row) row.appendChild(c);
}
function appIcon(size, radius) { ensureAppIcon(); const i = inst('Asset/AppIcon'); i.resize(size, size); i.cornerRadius = radius; return i; }

async function buildPagerDots() {
  if (findComp('PagerDots')) return;
  const sec = newSection('PagerDots', 'components/onboarding/components/PagerDots.tsx — centered row, gap 6, padding-bottom 4. Dots 6 high, radius 3: inactive 6 wide ink6 #243a59, active 22 wide blue400 #63b3ff.');
  const comps = [];
  for (let s = 1; s <= 5; s++) {
    const c = comp('Step=' + s, 'HORIZONTAL', { itemSpacing: 6, paddingBottom: 4, counterAxisAlignItems: 'CENTER' });
    for (let i = 1; i <= 5; i++) c.appendChild(bar('dot ' + i, i === s ? 22 : 6, 6, ob(i === s ? 'blue4' : 'ink6'), 3));
    comps.push(c);
  }
  simpleSet(comps, sec, 'PagerDots', 900, 'components/onboarding/components/PagerDots.tsx. <PagerDots count={5} index />.');
}

async function buildPrimaryButton() {
  if (findComp('PrimaryButton')) return;
  const sec = newSection('PrimaryButton', 'components/onboarding/components/PrimaryButton.tsx — 358×50, radius 12, padding-x 16, gap 8. Enabled: blue500 #4a9ef0, label and ArrowRight bold 18 in #0a1424, shadow blue400 0/8 blur 16 at 55%. Disabled: ink3, label fg3, no shadow. Label 15/600, -0.15.');
  const comps = [];
  for (const state of ['Enabled', 'Disabled', 'NoIcon']) {
    const on = state !== 'Disabled';
    const c = comp('State=' + state, 'HORIZONTAL', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', itemSpacing: 8, cornerRadius: 12, paddingLeft: 16, paddingRight: 16 });
    c.primaryAxisSizingMode = c.counterAxisSizingMode = 'FIXED'; c.resize(358, 50); c.fills = ob(on ? 'blue5' : 'ink3');
    if (on) obShadow(c, 'blue4', 0.55, 8, 16);
    c.appendChild(sans(state === 'NoIcon' ? 'Enter Threadbase' : 'Continue', 15, 'Semi Bold', on ? 'onBlue' : 'fg3', { ls: -0.15, name: 'label' }));
    if (state !== 'NoIcon') c.appendChild(icon('ArrowRight-bold', 18, ob(on ? 'onBlue' : 'fg3')));
    comps.push(c);
  }
  simpleSet(comps, sec, 'PrimaryButton', 900, 'components/onboarding/components/PrimaryButton.tsx. <PrimaryButton label onPress disabled showIcon />. The arrow becomes ArrowLeft in RTL.');
}

async function terminalCard(parent, name) {
  const c = AL('VERTICAL', name || 'terminal card', { cornerRadius: 12, strokeWeight: 1, paddingTop: 12, paddingBottom: 12, paddingLeft: 12, paddingRight: 12 }); c.fills = ob('ink0'); c.strokes = ob('ink5');
  fill(parent, c);
  const h = AL('HORIZONTAL', 'header', { itemSpacing: 8, counterAxisAlignItems: 'CENTER', paddingBottom: 8, strokeBottomWeight: 1, strokeTopWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 }); h.strokes = ob('ink5');
  fill(c, h);
  for (const k of ['red', 'amber', 'green4']) { const d = figma.createEllipse(); d.name = 'dot'; d.resize(8, 8); d.fills = ob(k); h.appendChild(d); }
  const gap = spacer(); h.appendChild(gap); gap.layoutGrow = 1;
  h.appendChild(await mono('~/threadbase pair', 10, 'fg4', { name: 'title' }));
  vsp(c, 8);
  const body = AL('VERTICAL', 'body', { itemSpacing: 10 }); fill(c, body);
  return body;
}
async function buildTerminalCard() {
  if (findComp('TerminalCard')) return;
  const sec = newSection('TerminalCard', 'components/onboarding/components/TerminalCard.tsx — ink0 #04070b, 1px ink5 #1a2d47, radius 12, padding 12. Header gap 8, padding-bottom 8, 1px ink5 bottom, margin-bottom 8: three 8 dots (red400, amber400, green400), spacer, "~/threadbase pair" mono 10/500 fg4. Body is the children.');
  const c = colComp('TerminalCard', 358);
  wrapText(await terminalCard(c), await mono('$ tb-streamer pair', 12.5, 'fg1', { name: 'line' }));
  single(c, sec, 'components/onboarding/components/TerminalCard.tsx. <TerminalCard title>{children}</TerminalCard>. The onboarding screens draw their own copies because an instance cannot take new children.');
}

async function tooltipTrigger(size, font) {
  const t = AL('HORIZONTAL', 'trigger', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', strokeWeight: 1, cornerRadius: size / 2 });
  t.primaryAxisSizingMode = t.counterAxisSizingMode = 'FIXED'; t.resize(size, size); t.strokes = ob('fg4');
  t.appendChild(await mono('?', font, 'fg4', { bold: true, name: 'mark' }));
  return t;
}
async function buildInfoTooltip() {
  if (findComp('InfoTooltip')) return;
  const sec = newSection('InfoTooltip', 'components/onboarding/components/InfoTooltip.tsx — trigger 18 circle, 1px fg4, "?" mono 10/600 fg4. Open: panel 24 below (absolute), 260 wide, ink2 #0b1220, 1px ink6, radius 10, padding 12. Body 13/19 fg2; optional link 12/500 blue400 + ArrowRight bold 12; "Got it" mono 11/500 fg3. TokenTooltip (16 trigger, 220 panel) exists but nothing renders it.');
  const comps = [];
  for (const state of ['Closed', 'Open']) {
    const c = comp('State=' + state, 'VERTICAL', { itemSpacing: 6 });
    c.appendChild(await tooltipTrigger(18, 10));
    if (state === 'Open') {
      const p = AL('VERTICAL', 'panel', { itemSpacing: 8, cornerRadius: 10, strokeWeight: 1, paddingTop: 12, paddingBottom: 12, paddingLeft: 12, paddingRight: 12 }); p.fills = ob('ink2'); p.strokes = ob('ink6');
      p.counterAxisSizingMode = 'FIXED'; p.resize(260, 40); p.primaryAxisSizingMode = 'AUTO'; c.appendChild(p);
      wrapText(p, sans('Any reachable address — LAN IP, hostname, Tailscale IP, or a public URL. Must start with http:// or https://.', 13, 'Regular', 'fg2', { lh: 19, name: 'body' }));
      const l = AL('HORIZONTAL', 'link', { itemSpacing: 4, counterAxisAlignItems: 'CENTER' }); p.appendChild(l);
      l.appendChild(sans('Networking guide', 12, 'Medium', 'blue4', { name: 'label' })); l.appendChild(icon('ArrowRight-bold', 12, ob('blue4')));
      p.appendChild(await mono('Got it', 11, 'fg3', { name: 'dismiss' }));
    }
    comps.push(c);
  }
  simpleSet(comps, sec, 'InfoTooltip', 900, 'components/onboarding/components/InfoTooltip.tsx. <InfoTooltip text linkLabel linkUrl />. Token field copy: "A short-lived pt_ token or the full threadbase:// link from tb-streamer pair. Valid for 3 minutes — run tb-streamer pair again if it expires. Long-lived tb_ API keys also work." Link "Pairing docs".');
}

async function buildThreadField() {
  if (findComp('ThreadField')) return;
  const sec = newSection('ThreadField', 'components/onboarding/components/ThreadField.tsx — background art, 360×580 viewBox sliced to the step (×1.231 at 402×714), layer opacity 0.55. Seven wavy lines M-30 y0 Q 90 y1 180 y2 T 400 y0 (y0 = 110+55i). Even lines blue400 gradient (0 → 0.9 → 0), dash 4 6; odd amber400 (0 → 0.7 → 0), dash 2 8; width 1.4 on lines 0, 3, 6, else 0.8.');
  let paths = '';
  for (let i = 0; i < 7; i++) {
    const y0 = 110 + 55 * i, y1 = 85 + 55 * i, y2 = 120 + 55 * i, even = i % 2 === 0;
    paths += '<path d="M-30 ' + y0 + ' Q 90 ' + y1 + ' 180 ' + y2 + ' T 400 ' + y0 + '" fill="none" stroke="url(#' + (even ? 'b' : 'a') + ')" stroke-width="' + (i % 3 === 0 ? 1.4 : 0.8) + '" stroke-dasharray="' + (even ? '4 6' : '2 8') + '"/>';
  }
  const grad = (id, c, a) => '<linearGradient id="' + id + '" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="' + c + '" stop-opacity="0"/><stop offset="0.5" stop-color="' + c + '" stop-opacity="' + a + '"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></linearGradient>';
  const art = svgNode('<svg xmlns="http://www.w3.org/2000/svg" width="443" height="714" viewBox="0 0 360 580"><defs>' + grad('b', OB.blue4, 0.9) + grad('a', OB.amber, 0.7) + '</defs>' + paths + '</svg>', 'threads');
  const c = figma.createComponent(); c.name = 'ThreadField'; c.resize(402, 714); c.fills = []; c.clipsContent = true; c.opacity = 0.55;
  c.appendChild(art); art.x = -20.5; art.y = 0;
  const bg = figma.createFrame(); bg.name = 'preview bg'; bg.resize(c.width + 80, c.height + 80); bg.fills = ob('ink1');
  single(c, sec, 'components/onboarding/components/ThreadField.tsx. Absolute fill behind WelcomeStep; pointer-events none.'); sec.insertChild(2, bg); bg.x = 0; bg.y = 80;
}

// ---- screens ----
async function obScreen(name, step, back, skip, height) {
  const c = screenComp(name, ob('ink1')); if (height) c.resize(402, height);
  c.paddingTop = 62;
  const chrome = AL('HORIZONTAL', 'chrome', { primaryAxisAlignItems: 'SPACE_BETWEEN', counterAxisAlignItems: 'CENTER', minHeight: 44, paddingTop: 8, paddingBottom: 8, paddingLeft: 16, paddingRight: 16 }); fill(c, chrome);
  const b = AL('HORIZONTAL', 'back', { itemSpacing: 4, counterAxisAlignItems: 'CENTER', paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8 }); chrome.appendChild(b);
  if (back) { b.appendChild(icon('ArrowLeft-bold', 18, ob('fg2'))); b.appendChild(sans('Back', 13, 'Medium', 'fg2', { name: 'label' })); }
  const s = AL('HORIZONTAL', 'skip', { paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8 }); chrome.appendChild(s);
  if (skip) s.appendChild(sans('Pair later', 13, 'Medium', 'fg3', { name: 'label' }));
  const body = AL('VERTICAL', 'content', { paddingLeft: 22, paddingRight: 22, paddingTop: 4, clipsContent: true }); fill(c, body); body.layoutGrow = 1;
  const dots = AL('VERTICAL', 'dots', { counterAxisAlignItems: 'CENTER', paddingTop: 10, paddingBottom: 34, paddingLeft: 16, paddingRight: 16 }); fill(c, dots);
  dots.appendChild(inst('PagerDots', 'Step=' + step));
  return body;
}
function bgLayer(body, node) { body.insertChild(0, node); node.layoutPositioning = 'ABSOLUTE'; node.x = 0; node.y = 0; node.resize(402, body.height); }
function primary(parent, label, state) { const b = inst('PrimaryButton', 'State=' + (state || 'Enabled')); fill(parent, b); setInstanceText(b, 'label', label); return b; }
async function eyebrow(parent, text, color) { parent.appendChild(await mono(text, 11, color, { ls: 2, upper: true, name: 'eyebrow' })); vsp(parent, 14); }
async function obHeadline(parent, text, mb) { wrapText(parent, sans(text, 26, 'Semi Bold', 'fg0', { lh: 29, ls: -0.55, name: 'headline' })); vsp(parent, mb); }
async function backLink(parent) {
  const r = AL('HORIZONTAL', 'back link', { itemSpacing: 4, counterAxisAlignItems: 'CENTER', paddingTop: 4, paddingBottom: 4 }); parent.appendChild(r);
  r.appendChild(icon('ArrowLeft-bold', 16, ob('blue4'))); r.appendChild(await mono('← Other options', 12.5, 'blue4', { name: 'label' })); vsp(parent, 4);
}
async function choiceCard(parent, title, badge, bodyText, highlighted) {
  const c = AL('VERTICAL', title, { cornerRadius: 8, strokeWeight: 1, paddingTop: 14, paddingBottom: 14, paddingLeft: 14, paddingRight: 14, itemSpacing: 4 }); fill(parent, c);
  c.strokes = ob(highlighted ? 'blue4' : 'ink5'); if (highlighted) c.fills = hex('#60a5fa', 0.08);
  const h = AL('HORIZONTAL', 'header', { primaryAxisAlignItems: 'SPACE_BETWEEN', counterAxisAlignItems: 'CENTER', itemSpacing: 8 }); fill(c, h);
  h.appendChild(sans(title, 17, 'Semi Bold', 'fg0', { name: 'title' }));
  if (badge) h.appendChild(await mono(badge, 10, 'blue4', { ls: 0.4, upper: true, bold: true, name: 'badge' }));
  wrapText(c, await mono(bodyText, 12, 'fg3', { lh: 18, name: 'body' }));
  vsp(parent, 12);
}

async function buildOnboardingSteps() {
  if (findComp('Onboarding')) return;
  const sec = newSection('Onboarding', 'components/onboarding/* — the five steps inside OnboardingShell (ink1 #070b11; chrome row 8×16 with Back (ArrowLeft bold 18 + 13/500 fg2) and, on Connect only, "Pair later" 13/500 fg3; PagerDots in a 10/34 footer). Content padding 22. Literal palette, not the theme tokens; only ServerFormFields in manual pairing uses theme tokens. Manual pairing is a scroll view, drawn at full height.');
  const comps = [];

  { // Language
    const b = await obScreen('Step=Language', 1, false, false); b.paddingTop = 20;
    await eyebrow(b, '> 01 / language', 'blue4');
    wrapText(b, sans('Choose your language.', 30, 'Semi Bold', 'fg0', { lh: 34, ls: -0.7, name: 'headline' })); vsp(b, 8);
    wrapText(b, sans('You can change this later in Settings.', 14, 'Regular', 'fg2', { lh: 21, name: 'body' })); vsp(b, 24);
    const opts = AL('VERTICAL', 'options', { itemSpacing: 10 }); fill(b, opts);
    for (const [label, rtl, on] of [['English', false, true], ['עברית', true], ['العربية', true], ['Русский', false]]) {
      const r = AL('HORIZONTAL', label, { primaryAxisAlignItems: 'SPACE_BETWEEN', counterAxisAlignItems: 'CENTER', minHeight: 56, cornerRadius: 12, strokeWeight: 1, paddingLeft: 16, paddingRight: 16 }); fill(opts, r);
      r.fills = ob(on ? 'ink3' : 'ink2'); r.strokes = ob(on ? 'blue5' : 'ink5');
      const chk = AL('HORIZONTAL', 'check', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', cornerRadius: 12, strokeWeight: 1 }); chk.primaryAxisSizingMode = chk.counterAxisSizingMode = 'FIXED'; chk.resize(24, 24);
      if (on) { chk.fills = ob('blue5'); chk.appendChild(icon('Check-bold', 16, ob('ink1'))); } else chk.strokes = ob('ink6');
      const t = sans(label, 17, 'Medium', on ? 'fg0' : 'fg1', { name: 'label' });
      if (rtl) { r.appendChild(chk); r.appendChild(t); } else { r.appendChild(t); r.appendChild(chk); }
    }
    flexSpacer(b); primary(b, 'Continue'); vsp(b, 14);
    comps.push(b.parent);
  }

  { // Welcome
    const b = await obScreen('Step=Welcome', 2, true, false);
    const mid = AL('VERTICAL', 'middle', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', paddingLeft: 24, paddingRight: 24 }); fill(b, mid); mid.layoutGrow = 1;
    const blk = figma.createFrame(); blk.name = 'icon block'; blk.resize(96, 96); blk.fills = []; blk.clipsContent = false; mid.appendChild(blk);
    const glow = figma.createEllipse(); glow.name = 'glow'; glow.resize(156, 156); glow.fills = hex('#63b3ff', 0.4); glow.opacity = 0.55; blk.appendChild(glow); glow.x = -30; glow.y = -30;
    const ic = appIcon(96, 22); blk.appendChild(ic); ic.strokes = hex('#63b3ff', 0.3); ic.strokeWeight = 1; obShadow(ic, 'blue4', 0.55, 16, 40);
    vsp(mid, 32);
    mid.appendChild(await mono('// ambient coding', 11, 'fg3', { ls: 2, upper: true, name: 'eyebrow' })); vsp(mid, 14);
    const s = 'Pull a thread.\nWatch it weave.';
    const h = sans(s, 36, 'Semi Bold', 'fg0', { lh: 36, ls: -1, center: true, name: 'headline' }); h.setRangeFills(s.indexOf('Watch'), s.length, ob('blue4')); mid.appendChild(h); vsp(mid, 14);
    const body = sans('A remote control for Claude Code and Codex, on the device you actually carry.', 14.5, 'Regular', 'fg2', { lh: 22, center: true, name: 'body' });
    body.textAutoResize = 'HEIGHT'; body.resize(280, body.height); mid.appendChild(body);
    primary(b, 'Get started'); vsp(b, 14);
    bgLayer(b, inst('ThreadField'));
    comps.push(b.parent);
  }

  { // Connect: choose
    const b = await obScreen('Step=ConnectChoose', 3, true, true);
    await eyebrow(b, '> 03 / pair', 'amber'); await obHeadline(b, 'Connect a runtime.', 14);
    wrapText(b, await mono('Pick how you want to hand the server its keys.', 12.5, 'fg3', { lh: 19, name: 'blurb' })); vsp(b, 10);
    wrapText(b, await mono('Your phone reaches your computer over the same Wi‑Fi, a VPN (for example Tailscale), or a public tunnel URL.', 12, 'fg4', { lh: 18, name: 'hint' })); vsp(b, 16);
    await choiceCard(b, 'Scan QR', 'Recommended', 'Run tb-streamer pair on your server to print a QR. Fastest, no typing.', true);
    await choiceCard(b, 'Type / paste manually', null, 'Run tb-streamer pair on your server, then paste the URL + token — or the full threadbase:// link.', false);
    comps.push(b.parent);
  }

  { // Connect: QR explanation
    const b = await obScreen('Step=ConnectQR', 3, true, true);
    await backLink(b); await eyebrow(b, '> 03 / pair · qr', 'amber'); await obHeadline(b, 'Scan to pair.', 14);
    const tb = await terminalCard(b);
    for (const l of ['1. On your server, run tb-streamer pair. A QR will print to the terminal.', '2. Tap Open camera below. Threadbase will ask permission to use the camera — that\'s only used to read the QR.', '3. Point your phone at the QR. The pair token is valid for 3 minutes; if it expires, just run tb-streamer pair again.'])
      wrapText(tb, await mono(l, 12.5, 'fg2', { lh: 19, name: 'line' }));
    flexSpacer(b); primary(b, 'Open camera');
    const link = AL('VERTICAL', 'manual link', { counterAxisAlignItems: 'CENTER', paddingTop: 12, paddingBottom: 12 }); fill(b, link);
    link.appendChild(await mono('Use manual entry instead', 12.5, 'blue4', { name: 'label' })); vsp(b, 14);
    comps.push(b.parent);
  }

  { // Connect: manual, failed
    const b = await obScreen('Step=ConnectManualError', 3, true, true, 1180);
    await backLink(b); await eyebrow(b, '> 03 / pair', 'amber'); await obHeadline(b, 'Connect a runtime.', 14);
    b.appendChild(await mono('Scan a QR instead →', 12.5, 'blue4', { name: 'qr link' })); vsp(b, 10);
    const tb = await terminalCard(b); tb.itemSpacing = 0;
    tb.appendChild(await mono('On your computer', 10, 'fg3', { ls: 1, upper: true, bold: true, name: 'label' })); vsp(tb, 4);
    wrapText(tb, sans('Open Terminal and run:', 12, 'Regular', 'fg3', { lh: 17, name: 'hint' })); vsp(tb, 6);
    const cp = AL('HORIZONTAL', 'copy row', { primaryAxisAlignItems: 'SPACE_BETWEEN', counterAxisAlignItems: 'CENTER', cornerRadius: 6, strokeWeight: 1, paddingTop: 7, paddingBottom: 7, paddingLeft: 10, paddingRight: 10 }); cp.fills = ob('ink3'); cp.strokes = ob('ink5'); fill(tb, cp);
    cp.appendChild(await mono('$ tb-streamer pair', 12.5, 'fg1', { name: 'command' })); cp.appendChild(await mono('copy', 10.5, 'blue4', { ls: 0.3, bold: true, name: 'badge' })); vsp(tb, 6);
    wrapText(tb, sans('It prints a URL + token (or a threadbase:// link) — paste below.', 12, 'Regular', 'fg3', { lh: 17, name: 'hint' }));
    vsp(b, 16);
    const form = inst('ServerFormFields'); fill(b, form); form.fills = []; form.paddingLeft = form.paddingRight = form.paddingTop = form.paddingBottom = 0;
    vsp(b, 8); wrapText(b, await mono('Enter a full http:// or https:// server address.', 12, 'red', { name: 'url error' })); vsp(b, 10);
    const log = AL('VERTICAL', 'log', { itemSpacing: 2, paddingTop: 8, strokeTopWeight: 1, strokeBottomWeight: 0, strokeLeftWeight: 0, strokeRightWeight: 0 }); log.strokes = ob('ink5'); fill(b, log);
    for (const [i, text, k] of [['01', 'resolving 192.168.1.10:8766', 'fg3'], ['02', 'reached server', 'green4'], ['03', 'exchanging token…', 'blue4'], ['04', 'token rejected: expired', 'red']]) {
      const t = await mono('[' + i + '] ' + text, 12, k, { lh: 18, name: 'line' }); t.setRangeFills(0, 4, ob('fg4')); wrapText(log, t);
    }
    vsp(b, 8); b.appendChild(sans('Need help? Contact support', 12, 'Medium', 'blue4', { name: 'support link' }));
    flexSpacer(b); primary(b, 'Retry'); vsp(b, 14);
    comps.push(b.parent);
  }

  const bell = c => svgNode('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>', 'bell');
  for (const on of [false, true]) { // Notifications
    const b = await obScreen('Step=Notifications' + (on ? 'On' : 'Off'), 4, true, false);
    await eyebrow(b, '> 04 / notify', 'amber'); await obHeadline(b, 'Wake me only when it counts.', 6);
    wrapText(b, sans('Push fires on plan-ready, tool-confirms, and run failures. That’s it.', 13.5, 'Regular', 'fg2', { lh: 20, name: 'subhead' })); vsp(b, 6);
    wrapText(b, sans('Threadbase taps you when a session needs a decision, finishes a run, or hits an error — the things worth knowing without watching a terminal.', 13, 'Regular', 'fg3', { lh: 19, name: 'body' })); vsp(b, 18);
    const pv = AL('HORIZONTAL', 'preview', { itemSpacing: 10, cornerRadius: 14, strokeWeight: 1, paddingTop: 14, paddingBottom: 14, paddingLeft: 14, paddingRight: 14 }); pv.fills = hex('#63b3ff', 0.06); pv.strokes = ob('ink5'); fill(b, pv);
    pv.appendChild(appIcon(32, 7));
    const col = AL('VERTICAL', 'text'); pv.appendChild(col); col.layoutGrow = 1;
    const hr = AL('HORIZONTAL', 'head', { primaryAxisAlignItems: 'SPACE_BETWEEN', counterAxisAlignItems: 'BASELINE' }); fill(col, hr);
    hr.appendChild(sans('THREADBASE', 11.5, 'Semi Bold', 'fg0', { name: 'app' })); hr.appendChild(await mono('now', 10.5, 'fg4', { name: 'time' }));
    vsp(col, 4); wrapText(col, sans('Plan ready · feat/queue', 13, 'Semi Bold', 'fg0', { lh: 17, name: 'title' }));
    vsp(col, 2); wrapText(col, sans('3 files queued for edit. Tap to review.', 12, 'Regular', 'fg2', { lh: 17, name: 'message' }));
    vsp(b, 14);
    const al = AL('HORIZONTAL', 'allow', { itemSpacing: 12, counterAxisAlignItems: 'CENTER', cornerRadius: 12, strokeWeight: 1, paddingTop: 14, paddingBottom: 14, paddingLeft: 14, paddingRight: 14 }); al.fills = ob('ink2'); al.strokes = ob(on ? 'blue5' : 'ink5'); fill(b, al);
    const tile = AL('HORIZONTAL', 'bell tile', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', cornerRadius: 11 }); tile.primaryAxisSizingMode = tile.counterAxisSizingMode = 'FIXED'; tile.resize(42, 42);
    tile.fills = on ? hex('#63b3ff', 0.15) : ob('ink3'); tile.appendChild(bell(on ? OB.blue4 : OB.fg3)); al.appendChild(tile);
    const tc = AL('VERTICAL', 'text', { itemSpacing: 3 }); al.appendChild(tc); tc.layoutGrow = 1;
    tc.appendChild(sans('Push notifications', 13.5, 'Semi Bold', 'fg0', { name: 'title' }));
    tc.appendChild(await mono(on ? 'ENABLED · alerts.threadbase.dev' : 'TAP TO ALLOW', 11, 'fg3', { name: 'status' }));
    const cb = AL('HORIZONTAL', 'checkbox', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', cornerRadius: 9, strokeWeight: 2 }); cb.primaryAxisSizingMode = cb.counterAxisSizingMode = 'FIXED'; cb.resize(18, 18);
    if (on) { cb.fills = ob('blue5'); cb.strokes = ob('blue5'); cb.appendChild(svgNode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="' + OB.onBlue + '" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>', 'check')); }
    else cb.strokes = ob('ink6');
    al.appendChild(cb);
    flexSpacer(b); primary(b, on ? 'Continue' : 'Skip for now'); vsp(b, 14);
    comps.push(b.parent);
  }

  for (const kind of ['Paired', 'Unpaired', 'PairedDiagnostics']) { // Done
    const paired = kind !== 'Unpaired';
    const b = await obScreen('Step=Done' + kind, 5, true, false);
    const mid = AL('VERTICAL', 'middle', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER' }); fill(b, mid); mid.layoutGrow = 1;
    const blk = figma.createFrame(); blk.name = 'check block'; blk.resize(96, 96); blk.fills = []; blk.clipsContent = false; mid.appendChild(blk);
    const halo = figma.createEllipse(); halo.name = 'halo'; halo.resize(96, 96); halo.fills = hex('#4ade80', 0.35); blk.appendChild(halo);
    const disc = figma.createEllipse(); disc.name = 'disc'; disc.resize(64, 64); disc.fills = ob('green5'); obShadow(disc, 'green4', 0.65, 16, 40); blk.appendChild(disc); disc.x = disc.y = 16;
    const ck = svgNode('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="' + OB.onBlue + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>', 'check'); blk.appendChild(ck); ck.x = ck.y = 34;
    vsp(mid, 24);
    mid.appendChild(await mono(paired ? 'Handshake complete' : 'All set', 11, paired ? 'green4' : 'fg3', { ls: 2, upper: true, name: 'eyebrow' })); vsp(mid, 14);
    mid.appendChild(sans(paired ? 'Thread is live.' : 'You\'re in.', 32, 'Semi Bold', 'fg0', { lh: 34, ls: -0.8, center: true, name: 'headline' })); vsp(mid, 12);
    const body = sans(paired ? 'Your laptop is listening. Open a session whenever the mood strikes.' : 'Skip it for now — you can connect a runtime from Settings whenever you\'re ready.', 14, 'Regular', 'fg2', { lh: 21, center: true, name: 'body' });
    body.textAutoResize = 'HEIGHT'; body.resize(280, body.height); mid.appendChild(body); vsp(mid, 22);
    const pill = AL('HORIZONTAL', 'pill', { itemSpacing: 8, counterAxisAlignItems: 'CENTER', cornerRadius: 10, strokeWeight: 1, paddingTop: 10, paddingBottom: 10, paddingLeft: 14, paddingRight: 14 }); pill.fills = ob('ink2'); pill.strokes = ob('ink5'); mid.appendChild(pill);
    const d = figma.createEllipse(); d.name = 'dot'; d.resize(7, 7); d.fills = paired ? ob('green5') : ob('fg4', 0.7); pill.appendChild(d);
    pill.appendChild(await mono(paired ? 'paired · Studio Mac · 192.168.1.10 · 8766' : 'no runtime paired · pair from Settings', 11, 'fg3', { lh: 15, name: 'label' }));
    if (kind === 'PairedDiagnostics') {
      const dr = AL('HORIZONTAL', 'diagnostics', { itemSpacing: 12, counterAxisAlignItems: 'CENTER', cornerRadius: 12, strokeWeight: 1, paddingTop: 14, paddingBottom: 14, paddingLeft: 14, paddingRight: 14 }); dr.fills = ob('ink2'); dr.strokes = ob('ink5'); fill(b, dr);
      const col = AL('VERTICAL', 'text', { itemSpacing: 2 }); dr.appendChild(col); col.layoutGrow = 1;
      col.appendChild(sans('Anonymous diagnostics', 14, 'Semi Bold', 'fg0', { name: 'title' }));
      wrapText(col, sans('Help improve Threadbase by sending crash reports and basic stability data not linked to your identity.', 12, 'Regular', 'fg3', { lh: 17, name: 'body' }));
      col.appendChild(sans('Learn more', 12, 'Semi Bold', 'green4', { name: 'link' }));
      const sw = switchNode(false); sw.fills = ob('ink5'); dr.appendChild(sw);
      vsp(b, 14);
    }
    primary(b, paired ? 'Enter Threadbase' : 'Continue — I\'ll pair later', 'NoIcon'); vsp(b, 14);
    const glow = figma.createEllipse(); glow.name = 'radial glow'; glow.opacity = 0.35;
    glow.fills = [{ type: 'GRADIENT_RADIAL', gradientTransform: [[1, 0, 0], [0, 1, 0]], gradientStops: [{ position: 0, color: { r: 0.29, g: 0.87, b: 0.5, a: 0.5 } }, { position: 1, color: { r: 0.29, g: 0.87, b: 0.5, a: 0 } }] }];
    bgLayer(b, glow); glow.resize(442, 714); glow.x = -20; glow.y = 271 - 357;
    comps.push(b.parent);
  }

  simpleSet(comps, sec, 'Onboarding', 2200, 'components/onboarding/OnboardingNavigator.tsx: Language → Welcome → Connect → Notifications → Done. Connect also opens PairScannerModal, PairConfirmGate and PairCameraIdentityCard. "← Other options" really renders two arrows (icon + string).');
}

async function statusBar() {
  const bar = AL('HORIZONTAL', 'status bar', { counterAxisAlignItems: 'CENTER' });
  bar.paddingLeft = 32; bar.paddingRight = 32; bar.paddingTop = 18; bar.paddingBottom = 10;
  bar.appendChild(await T('19:44', 'label/lg', 'text/primary'));
  return bar;
}
async function sectionHeader(label, color, count) {
  const row = AL('HORIZONTAL', 'section: ' + label, { counterAxisAlignItems: 'CENTER' }); sp(row, 'itemSpacing', 'sm'); sp(row, 'paddingTop', 'md');
  if (color !== 'text/secondary') { const d = figma.createEllipse(); d.resize(7, 7); d.fills = P(color); row.appendChild(d); }
  row.appendChild(await T(label, 'label/xs', color, { letterSpacing: { unit: 'PERCENT', value: 18 } }));
  const line = figma.createRectangle(); line.name = 'rule'; line.resize(10, 1); line.fills = P('border');
  fill(row, line);
  if (count) row.appendChild(await T(count, 'label/xs', 'text/secondary'));
  return row;
}
function screenFrame(name, x) {
  const f = AL('VERTICAL', name, { clipsContent: true });
  f.primaryAxisSizingMode = 'FIXED'; f.counterAxisSizingMode = 'FIXED'; f.resize(402, 874);
  f.fills = P('bg/primary'); f.x = x; f.y = 0;
  return f;
}
async function appHeader(title, withIcons) {
  const h = AL('HORIZONTAL', 'header', { counterAxisAlignItems: 'CENTER' }); sp(h, 'paddingLeft', 'lg'); sp(h, 'paddingRight', 'lg'); sp(h, 'paddingTop', 'sm'); sp(h, 'paddingBottom', 'md'); sp(h, 'itemSpacing', 'sm');
  const logo = figma.createRectangle(); logo.name = 'app mark'; logo.resize(28, 28); logo.cornerRadius = 6; logo.fills = P('bg/card');
  h.appendChild(logo);
  h.appendChild(await T(title, 'label/xl', 'text/primary', { name: 'title' }));
  fill(h, spacer());
  if (withIcons) {
    const icons = AL('HORIZONTAL', 'actions', { itemSpacing: 20 });
    for (const n of ['MagnifyingGlass', 'SlidersHorizontal', 'Gear']) icons.appendChild(icon(n, 22, 'text/secondary'));
    h.appendChild(icons);
  }
  return h;
}
async function segmented() {
  const outer = AL('HORIZONTAL', 'segmented', { strokeWeight: 1, clipsContent: true }); rad(outer, 'md'); outer.fills = P('bg/secondary'); outer.strokes = P('border');
  for (const [label, active] of [['Now', true], ['Projects', false]]) {
    const seg = AL('HORIZONTAL', label, { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER' });
    seg.counterAxisSizingMode = 'FIXED'; seg.resize(100, 44);
    if (active) PA(seg, 'fills', 'text/accent', 0.2);
    seg.appendChild(await T(label, active ? 'label/base' : 'body/base', active ? 'text/primary' : 'text/secondary'));
    fill(outer, seg);
  }
  return outer;
}
async function filterChips() {
  const row = AL('HORIZONTAL', 'filters'); sp(row, 'itemSpacing', 'sm');
  const a = AL('HORIZONTAL', 'needs me', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', strokeWeight: 1 });
  a.counterAxisSizingMode = 'FIXED'; a.resize(100, 48); rad(a, 'md'); sp(a, 'itemSpacing', 'sm');
  a.fills = P('bg/secondary'); PA(a, 'strokes', 'status/waiting', 0.5);
  const d = figma.createEllipse(); d.resize(8, 8); d.fills = P('status/waiting'); a.appendChild(d);
  a.appendChild(await T('Only what needs me', 'label/base', 'status/waiting'));
  fill(row, a);
  const b = AL('HORIZONTAL', 'everything', { primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', strokeWeight: 1 });
  b.counterAxisSizingMode = 'FIXED'; b.resize(120, 48); rad(b, 'md'); sp(b, 'paddingLeft', 'lg'); sp(b, 'paddingRight', 'lg');
  b.strokes = P('text/accent');
  b.appendChild(await T('Everything', 'label/base', 'text/primary'));
  row.appendChild(b);
  return row;
}
function content(frame) {
  const c = AL('VERTICAL', 'content'); sp(c, 'paddingLeft', 'lg'); sp(c, 'paddingRight', 'lg'); sp(c, 'itemSpacing', 'sm');
  fill(frame, c);
  return c;
}
function fab(frame) {
  const f = variant('FAB', 'Collapsed=false');
  frame.appendChild(f);
  f.layoutPositioning = 'ABSOLUTE';
  f.x = frame.width - f.width - 20;
  f.y = frame.height - f.height - 58;
  f.constraints = { horizontal: 'MAX', vertical: 'MAX' };
}

async function buildScreens(screensPage) {
  await figma.setCurrentPageAsync(screensPage);
  const has = n => screensPage.children.some(c => c.name === n);
  if (!has('Now — dark')) {
    const f = screenFrame('Now — dark', 0);
    f.appendChild(await statusBar());
    fill(f, await appHeader('Threadbase', true));
    const c = content(f);
    fill(c, await segmented());
    fill(c, await filterChips());
    fill(c, await sectionHeader('NEEDS YOU · 1', 'status/waiting'));
    fill(c, variant('LiveCard', 'Kind=NeedsYou'));
    fill(c, await sectionHeader('WORKING · 2', 'status/running'));
    const w1 = variant('LiveCard', 'Kind=Working'); fill(c, w1);
    setInstanceText(w1, 'title', 'ledger-api · feat/idempotent-reconciliation');
    const w2 = variant('LiveCard', 'Kind=Working'); fill(c, w2);
    setInstanceText(w2, 'title', 'storefront · release/2026-09-checkout');
    setInstanceText(w2, 'label', 'Working · 12s');
    fill(c, await sectionHeader('EARLIER', 'text/secondary', '5'));
    fill(c, variant('EarlierRow', 'State=Resumable'));
    for (let i = 0; i < 4; i++) { const r = variant('EarlierRow', 'State=Plain'); fill(c, r); setInstanceText(r, 'title', 'Conversation'); }
    fab(f);
  }
  if (!has('Now — empty')) {
    const f = screenFrame('Now — empty', 480);
    f.appendChild(await statusBar());
    fill(f, await appHeader('Threadbase', true));
    const c = content(f);
    fill(c, await segmented());
    const e = variant('EmptyState', 'Action=Primary'); fill(f, e); e.layoutSizingVertical = 'FILL';
  }
  if (!has('Settings — servers')) {
    const f = screenFrame('Settings — servers', 960);
    f.appendChild(await statusBar());
    const toast = variant('Toast', 'Level=error'); fill(f, toast);
    setInstanceText(toast, 'title', "Can't reach Studio. Check your connection or server address.");
    setInstanceText(toast, 'message', 'This server did not respond.');
    fill(f, await appHeader('Settings', false));
    const c = content(f);
    fill(c, await sectionHeader('SERVERS', 'text/secondary', '2'));
    fill(c, variant('ServerListCard', 'Connected=true'));
    const off = variant('ServerListCard', 'Connected=false'); fill(c, off);
    setInstanceText(off, 'label', 'Studio');
    setInstanceText(off, 'url', 'https://studio-linux.tail:7071');
  }
  const ref = screensPage.children.find(n => n.name === 'Reference screenshots');
  if (!ref) {
    const note = rawText('Reference screenshots below: e2e/visual/theme-gallery/*.png at 1/3 scale. Row 1 = Now, row 2 = Projects; one column per theme.', 14, 'Regular', hex('#888888'));
    note.name = 'Reference screenshots'; note.x = 0; note.y = 920; note.resize(1360, note.height); note.textAutoResize = 'HEIGHT';
    screensPage.appendChild(note);
  }
}

// ---------- theme switch ----------
// The theme in use is whichever palette color/bg/primary currently aliases.
async function currentTheme() {
  const all = await figma.variables.getLocalVariablesAsync('COLOR');
  const bg = all.find(v => v.name === 'color/bg/primary');
  const alias = bg && bg.valuesByMode[Object.keys(bg.valuesByMode)[0]];
  const target = alias && alias.type === 'VARIABLE_ALIAS' && all.find(v => v.id === alias.id);
  return target ? target.name.split('/')[0] : null;
}
async function switchTheme(theme) {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  const color = cols.find(c => c.name === 'Color');
  const palettes = cols.find(c => c.name === 'Theme Palettes');
  if (!color || !palettes) throw new Error('Color / Theme Palettes collections not found');
  const all = await figma.variables.getLocalVariablesAsync('COLOR');
  const pal = {};
  for (const v of all) if (v.variableCollectionId === palettes.id) pal[v.name] = v;
  const mode = color.modes[0].modeId;
  let n = 0;
  for (const v of all) {
    if (v.variableCollectionId !== color.id || v.name.indexOf('color/brand/') === 0) continue;
    const target = pal[theme + '/' + v.name.slice('color/'.length)];
    if (!target) continue;
    v.setValueForMode(mode, { type: 'VARIABLE_ALIAS', id: target.id });
    n++;
  }
  return n;
}

// ---------- source links (Code Connect needs an Org plan; this is the Starter substitute) ----------
const REPO = 'https://github.com/RonenMars/threadbase-mobile/blob/main/';
const CATALOG_PAGES = {
  start: '00 Start Here',
  foundations: '10 Foundations',
  core: '20 Core & Shared',
  sessions: '30 Sessions',
  conversation: '40 Conversation & Terminal',
  connectivity: '50 Connectivity',
  experience: '60 Product Experience',
  patterns: '70 Patterns',
  screens: '80 Screens',
  visualQa: '90 Visual QA',
  deprecated: '99 Deprecated',
};
const CATALOG_PAGE_ORDER = Object.values(CATALOG_PAGES);
function ensureCatalogPages() {
  const pages = new Map();
  for (const name of CATALOG_PAGE_ORDER) {
    const matches = figma.root.children.filter(node => node.type === 'PAGE' && node.name === name);
    if (matches.length > 1) throw new Error('Duplicate page name "' + name + '"');
    const page = matches[0] || figma.createPage();
    page.name = name;
    pages.set(name, page);
  }
  return pages;
}
function tagBuildNode(node) {
  if (activeBuildGroup) node.setPluginData('threadbase-group', activeBuildGroup);
  return node;
}
async function runBuildJob(entry, pages) {
  const page = pages.get(entry.page);
  if (!page) throw new Error('Unknown catalog page "' + entry.page + '"');
  const errors = await runBuildPage([entry], page);
  if (errors.length) throw errors[0].error;
}
async function runBuildPage(entries, page) {
  compPage = page;
  await figma.setCurrentPageAsync(page);
  const errors = [];
  for (const entry of entries) {
    activeBuildGroup = entry.group;
    try {
      await entry.builder();
    } catch (error) {
      errors.push({ entry, error });
    } finally {
      activeBuildGroup = null;
    }
  }
  return errors;
}
function job(buildName, builder, page, group, kind) {
  return { buildName, builder, page, group, kind: kind || 'component', status: 'stable' };
}
function assetLocation(name, source) {
  if (name === 'ProviderMark') return [CATALOG_PAGES.core, 'Provider marks'];
  if (name === 'SweepBar' || name.indexOf('QuickAccess') === 0 || name.indexOf('Shelf') === 0) return [CATALOG_PAGES.experience, 'Product experience'];
  if (name.indexOf('SlashCommand') === 0) return [CATALOG_PAGES.conversation, 'Terminal'];
  if (/\/sessions\//.test(source)) return [CATALOG_PAGES.sessions, 'Sessions'];
  if (/\/(conversation|terminal|review)\//.test(source)) return [CATALOG_PAGES.conversation, 'Conversation'];
  if (/\/(servers|pair|browse)\//.test(source)) return [CATALOG_PAGES.connectivity, 'Connectivity'];
  if (/\/(onboarding|tour|diagnostics|feedback|settings|quick-access|shelf)\//.test(source)) return [CATALOG_PAGES.experience, 'Product experience'];
  return [CATALOG_PAGES.core, 'Core'];
}
function asset(name, source) {
  const [page, group] = assetLocation(name, source);
  return { name, source, page, group, kind: 'component', status: 'stable' };
}
const CATALOG = [
  job('icons', ensureIcons, CATALOG_PAGES.core, 'Assets', 'asset'),
  job('Banner', buildBanner, CATALOG_PAGES.core, 'Feedback'),
  job('EmptyState', buildEmptyState, CATALOG_PAGES.core, 'Feedback'),
  job('FAB', buildFAB, CATALOG_PAGES.core, 'Actions'),
  job('StateBadge', buildStateBadge, CATALOG_PAGES.sessions, 'Status'),
  job('LiveCard', buildLiveCard, CATALOG_PAGES.sessions, 'Now'),
  job('EarlierRow', buildEarlierRow, CATALOG_PAGES.sessions, 'Now'),
  job('ServerListCard', buildServerListCard, CATALOG_PAGES.connectivity, 'Servers'),
  job('ProviderMark', buildProviderMark, CATALOG_PAGES.core, 'Provider marks'),
  job('SkeletonBox', buildSkeleton, CATALOG_PAGES.core, 'Loading'),
  job('TimeBucketPills', buildTimeBucketPills, CATALOG_PAGES.sessions, 'Shared'),
  job('MessagePreview', buildMessagePreview, CATALOG_PAGES.sessions, 'Shared'),
  job('LoadingOverlay', buildLoadingOverlay, CATALOG_PAGES.core, 'Loading'),
  job('LiveDot', buildLiveDot, CATALOG_PAGES.sessions, 'Status'),
  job('SectionEyebrow', buildSectionEyebrow, CATALOG_PAGES.sessions, 'Now'),
  job('HistorySkeletonRow', buildHistorySkeletonRow, CATALOG_PAGES.sessions, 'Now'),
  job('CantResumeRow', buildCantResumeRow, CATALOG_PAGES.sessions, 'Now'),
  job('DrillFolderRow', buildDrillFolderRow, CATALOG_PAGES.sessions, 'Tree'),
  job('KnightRiderScanner', buildKnightRiderScanner, CATALOG_PAGES.sessions, 'Loading'),
  job('InlineError', buildInlineError, CATALOG_PAGES.core, 'Feedback'),
  job('ServerHeaderRow', buildServerHeaderRow, CATALOG_PAGES.sessions, 'Tree'),
  job('SessionBanner', buildSessionBanners, CATALOG_PAGES.sessions, 'Banners'),
  job('ServerStatusCard', buildServerStatusCard, CATALOG_PAGES.sessions, 'Banners'),
  job('ConversationListItem', buildConversationListItem, CATALOG_PAGES.sessions, 'Shared'),
  job('MessageBubble', buildMessageBubble, CATALOG_PAGES.conversation, 'Messages'),
  job('ThinkingCard', buildThinkingCard, CATALOG_PAGES.conversation, 'Messages'),
  job('ThinkingBubble', buildThinkingBubble, CATALOG_PAGES.conversation, 'Messages'),
  job('ToolCard', buildToolCard, CATALOG_PAGES.conversation, 'Messages'),
  job('DiffViewer', buildDiffViewer, CATALOG_PAGES.conversation, 'Messages'),
  job('MessageSkeletonRow', buildMessageSkeletonRow, CATALOG_PAGES.conversation, 'Messages'),
  job('InheritedHistoryDivider', buildInheritedHistoryDivider, CATALOG_PAGES.conversation, 'History'),
  job('LivePauseControl', buildLivePauseControl, CATALOG_PAGES.conversation, 'Controls'),
  job('SlowLoadingBanner', buildSlowLoadingBanner, CATALOG_PAGES.conversation, 'Feedback'),
  job('ChatComposer', buildChatComposer, CATALOG_PAGES.conversation, 'Composer'),
  job('StatusPill', buildStatusPill, CATALOG_PAGES.core, 'Status'),
  job('StatusStrip', buildStatusStrip, CATALOG_PAGES.core, 'Status'),
  job('StatusRow', buildStatusRow, CATALOG_PAGES.core, 'Status'),
  job('StatusSheet', buildStatusSheet, CATALOG_PAGES.core, 'Status'),
  job('CriticalDialog', buildCriticalDialog, CATALOG_PAGES.core, 'Overlays'),
  job('NavigationLockOverlay', buildNavigationLockOverlay, CATALOG_PAGES.core, 'Overlays'),
  job('ScreenHeader', buildScreenHeader, CATALOG_PAGES.core, 'Navigation'),
  job('HeaderOverflowMenu', buildHeaderOverflowMenu, CATALOG_PAGES.core, 'Navigation'),
  job('InfoModal', buildInfoModal, CATALOG_PAGES.core, 'Overlays'),
  job('QuestionCard', buildQuestionCard, CATALOG_PAGES.conversation, 'Terminal'),
  job('QuickAccess', buildQuickAccess, CATALOG_PAGES.experience, 'Quick access'),
  job('Shelf', buildShelf, CATALOG_PAGES.experience, 'Shelf'),
  job('Small banners', buildSmallBanners, CATALOG_PAGES.experience, 'Banners'),
  job('IdentityFingerprintBlock', buildIdentityFingerprint, CATALOG_PAGES.connectivity, 'Pairing'),
  job('AddServerButton', buildAddServerButton, CATALOG_PAGES.connectivity, 'Servers'),
  job('EncryptionRefusalBanner', buildEncryptionRefusalBanner, CATALOG_PAGES.connectivity, 'Encryption'),
  job('FilterPresets', buildFilterPresets, CATALOG_PAGES.connectivity, 'Servers'),
  job('NoServersWelcome', buildNoServersWelcome, CATALOG_PAGES.connectivity, 'Servers'),
  job('ServerBadge', buildServerBadge, CATALOG_PAGES.connectivity, 'Servers'),
  job('ServerIndexingBanner', buildServerIndexingBanner, CATALOG_PAGES.connectivity, 'Servers'),
  job('ServerFormFields', buildServerFormFields, CATALOG_PAGES.connectivity, 'Servers'),
  job('ServerErrorModal', buildServerErrorModal, CATALOG_PAGES.connectivity, 'Servers'),
  job('ServersStatusModal', buildServersStatusModal, CATALOG_PAGES.connectivity, 'Servers'),
  job('CacheAlertModal', buildCacheAlertModal, CATALOG_PAGES.connectivity, 'Servers'),
  job('FilterSortSheet', buildFilterSortSheet, CATALOG_PAGES.connectivity, 'Servers'),
  job('StatusRow server alerts', buildServerAlertRows, CATALOG_PAGES.core, 'Status'),
  job('NewSessionServerPicker', buildNewSessionServerPicker, CATALOG_PAGES.connectivity, 'Servers'),
  job('ServerClaudeFlagsSection', buildServerClaudeFlagsSection, CATALOG_PAGES.connectivity, 'Servers'),
  job('ServerEncryptionSection', buildServerEncryptionSection, CATALOG_PAGES.connectivity, 'Encryption'),
  job('ServerEditModal', buildServerEditModal, CATALOG_PAGES.connectivity, 'Servers'),
  job('ServerFilterSheet', buildServerFilterSheet, CATALOG_PAGES.connectivity, 'Servers'),
  job('PairConfirmGate', buildPairConfirmGate, CATALOG_PAGES.connectivity, 'Pairing'),
  job('PairScannerModal', buildPairScannerModal, CATALOG_PAGES.connectivity, 'Pairing'),
  job('RecentDirsModal', buildRecentDirsModal, CATALOG_PAGES.connectivity, 'Browse'),
  job('BrowseSlowBanner', buildBrowseSlowBanner, CATALOG_PAGES.connectivity, 'Browse'),
  job('SessionRow', buildSessionRows, CATALOG_PAGES.sessions, 'Hub'),
  job('MachineBadge', buildMachineBadge, CATALOG_PAGES.sessions, 'Status'),
  job('SessionStatusBadge', buildSessionStatusBadge, CATALOG_PAGES.sessions, 'Status'),
  job('NeedsYouCard', buildLiveCardWrappers, CATALOG_PAGES.sessions, 'Now'),
  job('ProjectHubCard', buildProjectHubCard, CATALOG_PAGES.sessions, 'Hub'),
  job('ExternalSessionBanner', buildExternalSessionBanner, CATALOG_PAGES.sessions, 'Banners'),
  job('ServerWarmingBanner', buildServerWarmingBanner, CATALOG_PAGES.sessions, 'Banners'),
  job('SessionDetailSlowBanner', buildSessionDetailSlowBanner, CATALOG_PAGES.sessions, 'Banners'),
  job('SyncCachedNotice', buildSyncCachedNotice, CATALOG_PAGES.sessions, 'Banners'),
  job('LeaveSessionModal', buildLeaveSessionModal, CATALOG_PAGES.sessions, 'Dialogs'),
  job('NameSessionModal', buildNameSessionModal, CATALOG_PAGES.sessions, 'Dialogs'),
  job('ModelEffortSheet', buildModelEffortSheet, CATALOG_PAGES.sessions, 'Sheets'),
  job('ConversationPreviewSheet', buildConversationPreviewSheet, CATALOG_PAGES.sessions, 'Sheets'),
  job('RemoteKeyboardControls', buildRemoteKeyboardControls, CATALOG_PAGES.sessions, 'Controls'),
  job('DiagnosticsPreview', buildDiagnosticsPreview, CATALOG_PAGES.experience, 'Diagnostics'),
  job('ReviewSheet', buildReviewSheet, CATALOG_PAGES.conversation, 'Review'),
  job('QuietHoursEditor', buildQuietHoursEditor, CATALOG_PAGES.experience, 'Settings'),
  job('SlashCommandBoard', buildSlashCommandBoard, CATALOG_PAGES.conversation, 'Terminal'),
  job('SlashCommandArgModal', buildSlashCommandArgModal, CATALOG_PAGES.conversation, 'Terminal'),
  job('TourOverlay', buildTourOverlay, CATALOG_PAGES.experience, 'Tour'),
  job('ConversationSearchView', buildConversationSearchView, CATALOG_PAGES.conversation, 'Conversation'),
  job('SessionHistoryFeed', buildSessionHistoryFeed, CATALOG_PAGES.conversation, 'Terminal'),
  job('TerminalOutput', buildTerminalOutput, CATALOG_PAGES.conversation, 'Terminal'),
  job('RootErrorBoundary', buildRootErrorBoundary, CATALOG_PAGES.core, 'Errors'),
  job('RenderErrorBoundary', buildRenderErrorBoundary, CATALOG_PAGES.core, 'Errors'),
  job('PagerDots', buildPagerDots, CATALOG_PAGES.experience, 'Onboarding'),
  job('PrimaryButton', buildPrimaryButton, CATALOG_PAGES.experience, 'Onboarding'),
  job('TerminalCard', buildTerminalCard, CATALOG_PAGES.experience, 'Onboarding'),
  job('InfoTooltip', buildInfoTooltip, CATALOG_PAGES.experience, 'Onboarding'),
  job('ThreadField', buildThreadField, CATALOG_PAGES.experience, 'Onboarding'),
  job('Onboarding', buildOnboardingSteps, CATALOG_PAGES.experience, 'Onboarding'),

  asset('Badge', 'components/ui/Badge.tsx'),
  asset('Card', 'components/ui/Card.tsx'),
  asset('ProgressBar', 'components/ui/ProgressBar.tsx'),
  asset('Toast', 'components/ui/Toast.tsx'),
  asset('Banner', 'components/ui/Banner.tsx'),
  asset('EmptyState', 'components/ui/EmptyState.tsx'),
  asset('FAB', 'components/ui/FAB.tsx'),
  asset('StateBadge', 'components/sessions/StateBadge.tsx'),
  asset('ServerChip', 'components/sessions/shared/ServerChip.tsx'),
  asset('LiveCard', 'components/sessions/now/LiveCard.tsx'),
  asset('EarlierRow', 'components/sessions/now/EarlierRow.tsx'),
  asset('ServerListCard', 'components/servers/ServerListCard.tsx'),
  asset('ProviderMark', 'components/sessions/shared/ProviderMark.tsx'),
  asset('SkeletonBox', 'components/ui/Skeleton.tsx'),
  asset('TimeBucketPill', 'components/sessions/shared/TimeBucketPills.tsx'),
  asset('TimeBucketPills', 'components/sessions/shared/TimeBucketPills.tsx'),
  asset('MessagePreview', 'components/sessions/shared/MessagePreview.tsx'),
  asset('LoadingOverlay', 'components/ui/LoadingOverlay.tsx'),
  asset('LiveDot', 'components/sessions/LiveDot.tsx'),
  asset('SectionEyebrow', 'components/sessions/now/SectionEyebrow.tsx'),
  asset('HistorySkeletonRow', 'components/sessions/now/HistorySkeletonRow.tsx'),
  asset('CantResumeRow', 'components/sessions/now/CantResumeRow.tsx'),
  asset('DrillFolderRow', 'components/sessions/tree/DrillFolderRow.tsx'),
  asset('KnightRiderScanner', 'components/sessions/KnightRiderScanner.tsx'),
  asset('InlineError', 'components/alerts/InlineError.tsx'),
  asset('ServerHeaderRow', 'components/sessions/tree/ServerHeaderRow.tsx'),
  asset('SessionBanner', 'components/sessions/ConnectionBanner.tsx'),
  asset('ServerStatusCard', 'components/sessions/banners/ServerUnsupportedBanner.tsx'),
  asset('ConversationListItem', 'components/sessions/shared/ConversationListItem.tsx'),
  asset('MessageBubble', 'components/conversation/MessageBubble.tsx'),
  asset('ThinkingCard', 'components/conversation/ThinkingCard.tsx'),
  asset('ThinkingBubble', 'components/conversation/ThinkingBubble.tsx'),
  asset('ToolCard', 'components/conversation/ToolCard.tsx'),
  asset('DiffViewer', 'components/conversation/DiffViewer.tsx'),
  asset('MessageSkeletonRow', 'components/conversation/MessageSkeletonRow.tsx'),
  asset('InheritedHistoryDivider', 'components/conversation/InheritedHistoryDivider.tsx'),
  asset('LivePauseControl', 'components/conversation/LivePauseControl.tsx'),
  asset('SlowLoadingBanner', 'components/conversation/SlowLoadingBanner.tsx'),
  asset('ChatComposer', 'components/conversation/ChatComposer.tsx'),
  asset('StatusPill', 'components/alerts/StatusPill.tsx'),
  asset('AvatarMenu', 'components/ui/AvatarMenu.tsx'),
  asset('StatusStrip', 'components/alerts/StatusStrip.tsx'),
  asset('StatusRow', 'components/alerts/StatusRow.tsx'),
  asset('StatusSheet', 'components/alerts/StatusSheet.tsx'),
  asset('CriticalDialog', 'components/alerts/CriticalDialog.tsx'),
  asset('NavigationLockOverlay', 'components/ui/NavigationLockOverlay.tsx'),
  asset('ScreenHeader', 'components/shared/ScreenHeader.tsx'),
  asset('HeaderOverflowMenu', 'components/shared/HeaderOverflowMenu.tsx'),
  asset('InfoModal', 'components/shared/InfoModal.tsx'),
  asset('QuestionCard', 'components/terminal/QuestionCard.tsx'),
  asset('QuickAccessChip', 'components/quick-access/QuickAccessChip.tsx'),
  asset('QuickAccessStrip', 'components/quick-access/QuickAccessStrip.tsx'),
  asset('QuickAccessActionSheet', 'components/quick-access/QuickAccessActionSheet.tsx'),
  asset('ShelfBubble', 'components/shelf/ShelfBubble.tsx'),
  asset('ShelfPanel', 'components/shelf/ShelfPanel.tsx'),
  asset('FirstShowBanner', 'components/tour/FirstShowBanner.tsx'),
  asset('AnonymousDiagnosticsConsentBanner', 'components/diagnostics/AnonymousDiagnosticsConsentBanner.tsx'),
  asset('SweepBar', 'components/SweepBar.tsx'),
  asset('AddServerButton', 'components/servers/AddServerButton.tsx'),
  asset('EncryptionRefusalBanner', 'components/servers/EncryptionRefusalBanner.tsx'),
  asset('FilterPresets', 'components/servers/FilterPresets.tsx'),
  asset('NoServersWelcome', 'components/servers/NoServersWelcome.tsx'),
  asset('ServerBadge', 'components/servers/ServerBadge.tsx'),
  asset('ServerIndexingBanner', 'components/servers/ServerIndexingBanner.tsx'),
  asset('ServerFormFields', 'components/servers/ServerFormFields.tsx'),
  asset('ServerErrorModal', 'components/servers/ServerErrorModal.tsx'),
  asset('ServersStatusModal', 'components/servers/ServersStatusModal.tsx'),
  asset('CacheAlertModal', 'components/servers/CacheAlertModal.tsx'),
  asset('FilterSortSheet', 'components/servers/FilterSortSheet.tsx'),
  asset('ServerMenuSheet', 'components/servers/ServersStatusModal.tsx'),
  asset('IdentityFingerprintBlock', 'components/pair/IdentityFingerprintBlock.tsx'),
  asset('PairCameraIdentityCard', 'components/pair/PairCameraIdentityCard.tsx'),
  asset('NewSessionServerPicker', 'components/servers/NewSessionServerPicker.tsx'),
  asset('ServerClaudeFlagsSection', 'components/servers/ServerClaudeFlagsSection.tsx'),
  asset('ServerEncryptionSection', 'components/servers/ServerEncryptionSection.tsx'),
  asset('ServerEditModal', 'components/servers/ServerEditModal.tsx'),
  asset('ServerFilterSheet', 'components/servers/ServerFilterSheet.tsx'),
  asset('PairConfirmGate', 'components/pair/PairConfirmGate.tsx'),
  asset('PairScannerModal', 'components/pair/PairScannerModal.tsx'),
  asset('RecentDirsModal', 'components/browse/RecentDirsModal.tsx'),
  asset('BrowseSlowBanner', 'components/browse/BrowseSlowBanner.tsx'),
  asset('SessionRow', 'components/sessions/hub/SessionRow.tsx'),
  asset('ConvRow', 'components/sessions/hub/ConvRow.tsx'),
  asset('MachineBadge', 'components/sessions/MachineBadge.tsx'),
  asset('SessionStatusBadge', 'components/sessions/SessionStatusBadge.tsx'),
  asset('NeedsYouCard', 'components/sessions/now/NeedsYouCard.tsx'),
  asset('WorkingCard', 'components/sessions/now/WorkingCard.tsx'),
  asset('ProjectHubCard', 'components/sessions/hub/ProjectHubCard.tsx'),
  asset('ExternalSessionBanner', 'components/sessions/ExternalSessionBanner.tsx'),
  asset('ServerWarmingBanner', 'components/sessions/banners/ServerWarmingBanner.tsx'),
  asset('SessionDetailSlowBanner', 'components/sessions/SessionDetailSlowBanner.tsx'),
  asset('SyncCachedNotice', 'components/sessions/SyncCachedNotice.tsx'),
  asset('LeaveSessionModal', 'components/sessions/LeaveSessionModal.tsx'),
  asset('NameSessionModal', 'components/sessions/NameSessionModal.tsx'),
  asset('ModelEffortSheet', 'components/sessions/ModelEffortSheet.tsx'),
  asset('ConversationPreviewSheet', 'components/sessions/shared/ConversationPreviewSheet.tsx'),
  asset('RemoteKeyboardControls', 'components/sessions/RemoteKeyboardControls.tsx'),
  asset('DiagnosticsPreview', 'components/feedback/DiagnosticsPreview.tsx'),
  asset('ReviewSheet', 'components/review/ReviewSheet.tsx'),
  asset('QuietHoursEditor', 'components/settings/QuietHoursEditor.tsx'),
  asset('SlashCommandBoard', 'components/shared/SlashCommandBoard.tsx'),
  asset('SlashCommandArgModal', 'components/shared/SlashCommandArgModal.tsx'),
  asset('TourOverlay', 'components/tour/TourOverlay.tsx'),
  asset('ConversationSearchView', 'components/conversation/ConversationSearchView.tsx'),
  asset('SessionHistoryFeed', 'components/terminal/SessionHistoryFeed.tsx'),
  asset('TerminalOutput', 'components/terminal/TerminalOutput.tsx'),
  asset('RootErrorBoundary', 'components/RootErrorBoundary.tsx'),
  asset('RenderErrorBoundary', 'components/RenderErrorBoundary.tsx'),
  asset('PagerDots', 'components/onboarding/components/PagerDots.tsx'),
  asset('PrimaryButton', 'components/onboarding/components/PrimaryButton.tsx'),
  asset('TerminalCard', 'components/onboarding/components/TerminalCard.tsx'),
  asset('InfoTooltip', 'components/onboarding/components/InfoTooltip.tsx'),
  asset('ThreadField', 'components/onboarding/components/ThreadField.tsx'),
  asset('Onboarding', 'components/onboarding/OnboardingNavigator.tsx'),
];
function buildSteps() {
  return CATALOG.filter(x => x.builder).map(x => [x.buildName, x.builder]);
}
function sourceAssets() {
  return CATALOG.filter(x => x.source);
}
async function linkSources() {
  const missing = [];
  for (const entry of sourceAssets()) {
    const node = findComp(entry.name);
    if (!node) { missing.push(entry.name); continue; }
    node.documentationLinks = [{ uri: REPO + entry.source }];
  }
  if (missing.length) throw new Error('not found: ' + missing.join(', '));
}

// Screenshots were uploaded over the MCP, which drops them on whatever page it likes.
const THEME_ORDER = ['dark', 'light', 'catppuccin', 'latte', 'nord', 'one-dark', 'rose-pine-dawn', 'tokyo-night-light'];
async function arrangeReferences(screensPage) {
  await figma.loadAllPagesAsync();
  const refs = figma.root.findAll(n => n.name.indexOf('theme-gallery-') === 0 && n.type !== 'PAGE');
  if (!refs.length) throw new Error('no theme-gallery-* image layers found');
  for (const n of refs) {
    const m = n.name.replace(/\.png$/, '').match(/^theme-gallery-(.+)-(now|projects)$/);
    if (!m) continue;
    const col = THEME_ORDER.indexOf(m[1]);
    if (n.parent !== screensPage) screensPage.appendChild(n);
    if ('resize' in n) n.resize(402, 874);
    n.x = (col < 0 ? THEME_ORDER.length : col) * 480;
    n.y = m[2] === 'now' ? 1100 : 2060;
  }
}

// ---------- entry ----------
async function init() {
  await figma.loadAllPagesAsync();
  const all = await figma.variables.getLocalVariablesAsync();
  for (const v of all) V[v.name] = v;
  for (const s of await figma.getLocalTextStylesAsync()) S[s.name] = s;
  for (const st of ['Regular', 'Medium', 'Semi Bold', 'Bold', 'Italic']) await figma.loadFontAsync({ family: 'Inter', style: st });
  await figma.loadFontAsync({ family: 'JetBrains Mono', style: 'Regular' });
  const pages = ensureCatalogPages();
  compPage = pages.get(CATALOG_PAGES.core);
  return pages;
}
async function build() {
  const pages = await init();
  const errors = [];
  const jobs = CATALOG.filter(x => x.builder);
  for (const pageName of CATALOG_PAGE_ORDER) {
    const pageJobs = jobs.filter(entry => entry.page === pageName);
    if (!pageJobs.length) continue;
    const pageErrors = await runBuildPage(pageJobs, pages.get(pageName));
    for (const { entry, error } of pageErrors) errors.push(entry.buildName + ': ' + error.message);
  }
  for (const page of pages.values()) clearDescs(page);
  try { await buildScreens(pages.get(CATALOG_PAGES.screens)); } catch (e) { errors.push('screens: ' + e.message); }
  try { await linkSources(); } catch (e) { errors.push('links: ' + e.message); }
  try { await arrangeReferences(pages.get(CATALOG_PAGES.visualQa)); } catch (e) { errors.push('references: ' + e.message); }
  return errors;
}

// ---------- plugin entry ----------
// Everything above is also sent as the prelude of every bridge job (see bridge.mjs).
const BRIDGE_HTML = `<body style="font:12px -apple-system,sans-serif;margin:8px;color:#333"><div id="s">connecting…</div><div id="auth" style="display:none;margin-top:6px"><input id="t" placeholder="paste .bridge-token" style="width:150px"><button id="b">save</button></div><script>
const B = 'http://localhost:7079';
const s = document.getElementById('s');
const auth = document.getElementById('auth');
let TOKEN = null;
const ask = msg => { TOKEN = null; auth.style.display = 'block'; s.textContent = msg; };
document.getElementById('b').onclick = () => {
  TOKEN = document.getElementById('t').value.trim();
  parent.postMessage({ pluginMessage: { type: 'token', token: TOKEN } }, '*');
  auth.style.display = 'none';
  s.textContent = 'connecting…';
};
onmessage = e => {
  const m = e.data.pluginMessage;
  if (!m) return;
  if (m.type === 'token') { if (m.token) TOKEN = m.token; else ask('paste the token the relay printed'); }
  if (m.type === 'result') fetch(B + '/result', { method: 'POST', headers: { 'x-bridge-token': TOKEN }, body: JSON.stringify(m.payload) }).then(() => { s.textContent = 'idle (last job ' + m.payload.id + ')'; }, () => {});
};
(async () => {
  for (;;) {
    if (!TOKEN) { await new Promise(r => setTimeout(r, 400)); continue; }
    try {
      const r = await fetch(B + '/next', { headers: { 'x-bridge-token': TOKEN } });
      if (r.status === 403) ask('token rejected, paste the current one');
      else if (r.status === 200) { const job = await r.json(); s.textContent = 'running job ' + job.id; parent.postMessage({ pluginMessage: { type: 'job', job } }, '*'); }
      else if (!/job/.test(s.textContent)) s.textContent = 'connected, idle';
    } catch (e) { s.textContent = 'relay not running, retrying…'; await new Promise(r => setTimeout(r, 2000)); }
  }
})();
</script></body>`;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
function startBridge() {
  figma.showUI(BRIDGE_HTML, { width: 260, height: 86, title: 'Threadbase bridge' });
  figma.clientStorage.getAsync('bridgeToken').then(t => figma.ui.postMessage({ type: 'token', token: t || null }));
  figma.ui.onmessage = async m => {
    if (!m) return;
    if (m.type === 'token') return figma.clientStorage.setAsync('bridgeToken', m.token);
    if (m.type !== 'job') return;
    const images = [];
    const snap = async (node, name, scale) => {
      const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale || 2 } });
      images.push({ name: name || node.name, b64: figma.base64Encode(bytes) });
      return name || node.name;
    };
    let payload;
    try {
      const value = await new AsyncFunction('figma', 'snap', m.job.code)(figma, snap);
      payload = { id: m.job.id, ok: true, value: value === undefined ? null : value, images };
    } catch (e) {
      payload = { id: m.job.id, ok: false, error: (e && e.message ? e.message + '\n' : '') + String((e && e.stack) || e), images };
    }
    try { JSON.stringify(payload); } catch (e) { payload.value = String(payload.value); }
    figma.ui.postMessage({ type: 'result', payload });
  };
}

(async () => {
  try {
    if (figma.command === 'bridge') { startBridge(); return; }
    if (figma.command && figma.command.indexOf('theme:') === 0) {
      let theme = figma.command.slice(6);
      if (theme === 'toggle') theme = (await currentTheme()) === 'dark' ? 'light' : 'dark';
      if (THEMES.indexOf(theme) < 0) throw new Error('Unknown theme ' + theme);
      const n = await switchTheme(theme);
      figma.closePlugin('Color → ' + theme + ' (' + n + ' aliases re-pointed)');
      return;
    }
    const errors = await build();
    if (errors.length) {
      console.error(errors.join('\n'));
      figma.closePlugin('Done with ' + errors.length + ' error(s) — see console: ' + errors[0]);
    } else {
      figma.closePlugin('Threadbase design system: components and screens built');
    }
  } catch (e) {
    figma.closePlugin('Failed: ' + e.message);
  }
})();
