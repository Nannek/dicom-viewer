// Single-viewport app — module-level ref avoids prop drilling between
// sibling components (Viewport sets, CinePlayer reads).
let _element: HTMLDivElement | null = null

export const setViewportElement = (el: HTMLDivElement | null): void => {
  _element = el
}

export const getViewportElement = (): HTMLDivElement | null => _element
