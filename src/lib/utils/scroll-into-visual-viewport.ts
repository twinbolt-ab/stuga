/**
 * Scrolls `element` into the visual viewport (the area not covered by the
 * on-screen keyboard on mobile). Falls back to `scrollIntoView` when the
 * Visual Viewport API is unavailable.
 *
 * Walks up the DOM to find the nearest scrollable ancestor and adjusts its
 * scrollTop so the element ends up roughly centered in the visible area.
 */
export function scrollIntoVisualViewport(element: HTMLElement | null): void {
  if (!element) return

  const viewport = window.visualViewport
  if (!viewport) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  const container = findScrollableAncestor(element)
  if (!container) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  const elRect = element.getBoundingClientRect()
  const visibleTop = viewport.offsetTop
  const visibleBottom = viewport.offsetTop + viewport.height
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
