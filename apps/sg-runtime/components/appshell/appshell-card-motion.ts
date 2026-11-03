/** APP-MOT-01 / SRM-B68. Approved MagicPath revisions 468221236900696064 / 468221248577622016. */
export type CardPositions = Map<HTMLElement, Pick<DOMRect, 'left' | 'top'>>
export type CardAnimations = Map<HTMLElement, Animation>

export function captureCardPositions(stack: HTMLElement | null): CardPositions {
  return new Map(Array.from(stack?.querySelectorAll<HTMLElement>('.as-app-card') ?? [], card => [card, card.getBoundingClientRect()]))
}

export function cancelCardAnimations(animations: CardAnimations) {
  for (const animation of animations.values()) animation.cancel()
  animations.clear()
}

export function animateCardPositions(stack: HTMLElement | null, before: CardPositions, collapsed: boolean, animations: CardAnimations, reducedMotion: boolean) {
  // The caller captures the currently painted positions before cancelling a previous flight.
  cancelCardAnimations(animations)
  if (reducedMotion) return
  Array.from(stack?.querySelectorAll<HTMLElement>('.as-app-card') ?? []).forEach((card, index) => {
    const previous = before.get(card)
    if (!previous || typeof card.animate !== 'function') return
    const next = card.getBoundingClientRect(), dx = previous.left - next.left, dy = previous.top - next.top
    if (Math.hypot(dx, dy) < 1) return
    const delay = collapsed ? (index === 2 ? 110 : index === 3 ? 260 : 0) : (index === 3 ? 110 : index === 2 ? 260 : 0)
    const edgePull = (index === 2 ? 6 : index === 3 ? 8 : 0) * (collapsed ? 1 : -1)
    const animation = card.animate([
      {transform: `translate(${dx}px,${dy}px)`, offset: 0, easing: 'cubic-bezier(.68,0,.85,.42)'},
      {transform: `translate(${dx * .91 + edgePull}px,${dy * .91}px)`, offset: .28, easing: 'cubic-bezier(.18,.65,.3,1)'},
      {transform: 'translate(0,0)', offset: 1},
    ], {duration: 680, delay, fill: 'backwards'})
    animations.set(card, animation)
    animation.finished.then(() => {if (animations.get(card) === animation) animations.delete(card)}, () => {})
  })
}
