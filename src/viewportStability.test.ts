import { describe, expect, it } from "vitest";
import { isZoomShortcut, shouldBlockWheelGesture } from "./viewportStability";

const gesture = (deltaX: number, deltaY: number, ctrlKey = false, shiftKey = false) =>
  ({ deltaX, deltaY, ctrlKey, shiftKey });

describe("protection de l'interface au pavé tactile", () => {
  it("laisse fonctionner les défilements verticaux indépendants", () => {
    expect(shouldBlockWheelGesture(gesture(0, 250))).toBe(false);
    expect(shouldBlockWheelGesture(gesture(3, 120))).toBe(false);
    expect(shouldBlockWheelGesture(gesture(-4, -160))).toBe(false);
  });

  it("bloque les gestes horizontaux et le scroll latéral Shift + molette", () => {
    expect(shouldBlockWheelGesture(gesture(115, 3))).toBe(true);
    expect(shouldBlockWheelGesture(gesture(-90, 0))).toBe(true);
    expect(shouldBlockWheelGesture(gesture(0, 30, false, true))).toBe(true);
  });

  it("neutralise le pincement du pavé tactile transmis via Ctrl + molette", () => {
    expect(shouldBlockWheelGesture(gesture(0, -90, true))).toBe(true);
    expect(shouldBlockWheelGesture(gesture(1, 30, true))).toBe(true);
  });

  it("désactive les raccourcis de zoom sans bloquer les raccourcis métier", () => {
    const shortcut = (key: string, code: string, ctrlKey = true, altKey = false) =>
      ({ key, code, ctrlKey, altKey });
    expect(isZoomShortcut(shortcut("+", "Equal"))).toBe(true);
    expect(isZoomShortcut(shortcut("-", "Minus"))).toBe(true);
    expect(isZoomShortcut(shortcut("0", "Digit0"))).toBe(true);
    expect(isZoomShortcut(shortcut("Add", "NumpadAdd"))).toBe(true);
    expect(isZoomShortcut(shortcut("c", "KeyC"))).toBe(false);
    expect(isZoomShortcut(shortcut("+", "Equal", false))).toBe(false);
    expect(isZoomShortcut(shortcut("+", "Equal", true, true))).toBe(false);
  });
});
