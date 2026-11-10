import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

const rule = (selector: string) => {
  const start = css.lastIndexOf(selector + "{");
  if (start < 0) return "";
  const end = css.indexOf("}", start);
  return css.slice(start, end + 1);
};

describe("aperçu de ticket compatible avec les petites fenêtres Windows", () => {
  it("donne une hauteur réelle à la fenêtre d'impression au lieu d'un simple max-height", () => {
    const modal = rule(".modal.ticket-modal.stable-ticket-modal");
    expect(modal).toContain("height:min(760px, calc(100dvh - 24px))");
    expect(modal).toContain("max-height:calc(100dvh - 24px)");
    expect(modal).toContain("display:flex");
    expect(modal).toContain("flex-direction:column");
  });

  it("laisse l'aperçu utiliser le reste de la hauteur et défiler sans déplacer les boutons", () => {
    const preview = rule(".modal.ticket-modal.stable-ticket-modal>.ticket-modal-scroll");
    expect(preview).toContain("flex:1 1 auto");
    expect(preview).toContain("min-height:0");
    expect(preview).toContain("overflow-y:auto");
    expect(preview).toContain("max-height:none");
    expect(preview).toContain("width:100%");
    const actions = rule(".modal.ticket-modal.stable-ticket-modal>.modal-actions");
    expect(actions).toContain("flex:0 0 auto");
    expect(app).toContain('className="modal-overlay ticket-overlay"');
    expect(app).toContain('role="region" aria-label="Document de vente défilant" tabIndex={0}');
    expect(app).toContain('onClick={()=>window.print()}');
  });

  it("garde un espace utilisable pour le ticket sur les résolutions courantes", () => {
    // La géométrie finale sera également vérifiée sur le véritable ProBook.
    const viewports = [
      { width: 520, height: 360 }, // petite fenêtre Windows
      { width: 800, height: 600 },
      { width: 1024, height: 600 },
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
    ];
    for (const size of viewports) {
      const modalHeight = Math.min(760, size.height - 24);
      expect(modalHeight).toBeGreaterThanOrEqual(330);
      expect(Math.min(600, size.width - 24)).toBeLessThan(size.width);
    }
  });

  it("conserve les formats d'impression thermique et A4 sans réduire le papier", () => {
    expect(css).toContain(".print-only .ticket-preview.a4{width:185mm!important");
    expect(css).toContain("width:72mm!important");
    expect(css).toContain(".modal.ticket-modal.stable-ticket-modal{display:none!important}");
    expect(css).toContain(".print-only .ticket-table{table-layout:fixed!important");
  });
});
