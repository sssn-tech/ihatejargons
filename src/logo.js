// The ihatejargons mark: a speech bubble whose wavy line straightens out (jargon → plain words).
// Drawn on a 24px grid with currentColor, so it follows the host's light and dark themes.
export const logoPaths =
  '<path d="M5.5 4.25h13A2.75 2.75 0 0 1 21.25 7v7.75a2.75 2.75 0 0 1-2.75 2.75h-8.4l-4.35 3.05a.45.45 0 0 1-.71-.37V17.5A2.75 2.75 0 0 1 2.75 14.75V7A2.75 2.75 0 0 1 5.5 4.25Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
  '<path d="M6.6 11c1.05-1.9 2.15-1.9 3.2 0s2.15 1.9 3.2 0H17.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';

export function logo(size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${logoPaths}</svg>`;
}
