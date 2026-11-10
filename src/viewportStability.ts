/** Verrouille le déplacement de la fenêtre VestiFlow par les gestes du pavé tactile.
 * Le défilement vertical normal reste entièrement utilisable. */
export function shouldBlockWheelGesture(event: {
  ctrlKey: boolean;
  shiftKey: boolean;
  deltaX: number;
  deltaY: number;
}): boolean {
  if (event.ctrlKey) return true; // Pincement / zoom WebView2
  if (event.shiftKey && Math.abs(event.deltaY) > 0) return true; // Scroll latéral simulé
  return Math.abs(event.deltaX) > 1 && Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.15;
}

/** Empêche le raccourci de zoom du contenu sans interférer avec l'édition des champs. */
export function isZoomShortcut(event: {
  ctrlKey: boolean;
  altKey: boolean;
  key: string;
  code: string;
}): boolean {
  if (!event.ctrlKey || event.altKey) return false;
  return ["+", "=", "-", "_", "0"].includes(event.key)
    || ["NumpadAdd", "NumpadSubtract", "Numpad0"].includes(event.code);
}

/** À installer une seule fois au démarrage de la WebView. */
export function installViewportGestureGuard(): () => void {
  const wheel = (event: WheelEvent) => {
    if (shouldBlockWheelGesture(event)) event.preventDefault();
  };
  const keydown = (event: KeyboardEvent) => {
    if (isZoomShortcut(event)) event.preventDefault();
  };
  window.addEventListener("wheel", wheel, { capture: true, passive: false });
  window.addEventListener("keydown", keydown, { capture: true });
  return () => {
    window.removeEventListener("wheel", wheel, true);
    window.removeEventListener("keydown", keydown, true);
  };
}
