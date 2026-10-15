/** MagicPath SRM-B41/B42/B43: authored presentation, never a model request. */
export const chatWelcomeMotion = Object.freeze({ introDelay: 650, typingDuration: 1800 });
export type WelcomePhase = 'idle' | 'typing' | 'visible';

/** One sequence per supplier. Disposal also guards callbacks already queued for delivery. */
export function createWelcomeSequence(onPhase: (phase: WelcomePhase) => void) {
  let started = false;
  let disposed = false;
  let timers: ReturnType<typeof setTimeout>[] = [];
  return {
    start() {
      if (started || disposed) return;
      started = true;
      timers = [
        setTimeout(() => { if (!disposed) onPhase('typing'); }, chatWelcomeMotion.introDelay),
        setTimeout(() => { if (!disposed) onPhase('visible'); }, chatWelcomeMotion.introDelay + chatWelcomeMotion.typingDuration),
      ];
    },
    dispose() { disposed = true; timers.forEach(clearTimeout); timers = []; },
  };
}

/** Long messages start at their beginning; shorter ones are fully revealed. */
export function welcomeScrollTop(rowTop: number, rowHeight: number, viewportHeight: number, scrollHeight: number) {
  return Math.max(0, rowHeight > viewportHeight - 32 ? rowTop - 16 : scrollHeight - viewportHeight);
}

/** A deliberate upward scroll stays respected even within the bottom tolerance. */
export function resumesFollowing(previousTop: number, top: number, viewportHeight: number, scrollHeight: number) {
  return top > previousTop && scrollHeight - viewportHeight - top < 48;
}
