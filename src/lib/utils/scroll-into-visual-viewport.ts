/**
 * Scrolls `element` into the area not covered by the on-screen keyboard.
 *
 * Pass `bottomInset` (the keyboard height in CSS pixels) when the
 * Visual Viewport API can't be trusted — e.g. on Capacitor with
 * `Keyboard.resize: 'none'`, where visualViewport doesn't shrink for
 * the keyboard.
 *
 * Walks up the DOM to find the nearest scrollable ancestor and adjusts its
 * scrollTop so the element ends up roughly inside the visible area.
 */
export function scrollIntoVisualViewport(element: HTMLElement | null, bottomInset = 0): void {
  if (!element) return

  const viewport = window.visualViewport
  const visibleTop = viewport?.offsetTop ?? 0
  const visibleHeight = viewport?.height ?? window.innerHeight
  const visibleBottom = visibleTop + visibleHeight - bottomInset

  const container = findScrollableAncestor(element)
  if (!container) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  const elRect = element.getBoundingClientRect()
  const margin = 16

  let delta = 0
  if (elRect.bottom > visibleBottom - margin) {
    delta = elRect.bottom - (visibleBottom - margin)
  } else if (elRect.top < visibleTop + margin) {
    delta = elRect.top - (visibleTop + margin)
  }

  if (delta === 0) return

  container.scrollBy({ top: delta, behavior: 'smooth' })
}

function findScrollableAncestor(element: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = element.parentElement
  while (node) {
    const style = window.getComputedStyle(node)
    const overflowY = style.overflowY
    const isScrollable = overflowY === 'auto' || overflowY === 'scroll'
    if (isScrollable && node.scrollHeight > node.clientHeight) {
      return node
    }
    node = node.parentElement
  }
  return document.scrollingElement as HTMLElement | null
}
