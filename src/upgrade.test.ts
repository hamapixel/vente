import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import tauri from "../src-tauri/tauri.conf.json";
import pkg from "../package.json";

describe("VestiFlow upgrade compatibility", () => {
  it("uses the approved brand and a new version", () => {
    expect(tauri.productName).toBe("VestiFlow");
    expect(tauri.app.windows[0].title).toBe("VestiFlow");
    expect(pkg.version).toBe(tauri.version);
    expect(tauri.version).toBe("0.2.3");
  });
  it("keeps the old Tauri identifier and existing SQLite filename", () => {
    expect(tauri.identifier).toBe("ml.modestock.local");
    const source = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
    expect(source).toContain('app_local_data_dir()');
    expect(source).toContain('directory.join("modestock.db")');
  });
  it("permits a smaller Windows screen without forced horizontal overflow", () => {
    expect(tauri.app.windows[0].minWidth).toBeLessThanOrEqual(520);
    expect(tauri.app.windows[0].minHeight).toBeLessThanOrEqual(400);
    expect(tauri.app.windows[0].maximized).toBe(true);
    expect(tauri.app.windows[0].zoomHotkeysEnabled).toBe(false);
    const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    expect(styles).toContain("html,body,#root{width:100%;max-width:100%;min-width:0;margin:0}");
    expect(styles).toContain("@media(max-width:940px)");
    expect(styles).toContain("@media(max-height:670px)");
    expect(styles).toContain(".sidebar{");
    expect(styles).toContain("height:100vh;height:100dvh");
    expect(styles).toContain(".shell>.main>.content{");
    expect(styles).toContain("overflow-y:auto;");
    expect(styles).toContain(".shell>.sidebar{");
    expect(styles).toContain("overscroll-behavior:none;");
    expect(styles).toContain(".shell>.main>.topbar{");
    expect(styles).toContain("flex:0 0 auto;");
    const fixedSidebar = styles.match(/\.shell>\.sidebar\s*\{([^}]*)\}/)?.[1];
    expect(fixedSidebar).toBeDefined();
    expect(fixedSidebar).toMatch(/overflow\s*:\s*hidden/);
    expect(fixedSidebar).toMatch(/overscroll-behavior\s*:\s*none/);
    expect(fixedSidebar).not.toMatch(/overflow-y\s*:\s*auto/);
    expect(styles).toContain("@media(max-height:640px)");
    expect(styles).toContain("@media(max-height:560px)");
    expect(styles).toContain("@media(max-height:430px)");
    const contentPanel = styles.match(/\.shell>\.main>\.content\s*\{([^}]*)\}/)?.[1];
    expect(contentPanel).toMatch(/overflow-y\s*:\s*auto/);
  
  
  });

  it("separates POS catalog and cart scroll regions and hides both scrollbars", () => {
    const source = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    expect(source).toContain('page === "pos" ? " content-pos" : ""');
    expect(source).toContain('className="pos-products-scroll"');
    expect(source).toContain('aria-label="Liste des produits de la caisse"');
    expect(source).toContain('className="cart-scroll"');
    expect(source).toContain('aria-label="Panier et règlement de la vente"');
    expect(source).toContain('tabIndex={0}');
    const catalog = styles.match(/\.content-pos \.pos-products-scroll\s*\{([^}]*)\}/)?.[1];
    const cart = styles.match(/\.content-pos \.cart-scroll\s*\{([^}]*)\}/)?.[1];
    expect(catalog).toMatch(/overflow-y\s*:\s*auto/);
    expect(cart).toMatch(/overflow-y\s*:\s*auto/);
    expect(catalog).toMatch(/scrollbar-width\s*:\s*none/);
    expect(cart).toMatch(/scrollbar-width\s*:\s*none/);
    expect(styles).toContain(".content-pos .cart-scroll::-webkit-scrollbar");
    expect(styles).toContain(".content-pos .pos-products-scroll::-webkit-scrollbar");
    expect(styles).toContain("overscroll-behavior:contain;");
    expect(styles).toContain(".content-pos .cart-lines{");
    expect(styles).toContain("max-height:none;");
    expect(styles).toContain(".content-pos>.pos-layout{");
    expect(styles).toContain("align-items:stretch;");
    const fixedSidebar = styles.match(/\.shell>\.sidebar\s*\{([^}]*)\}/)?.[1];
    expect(fixedSidebar).toMatch(/overflow\s*:\s*hidden/);
  });


  it("garde les formulaires, documents et noms longs à l'intérieur de la fenêtre", () => {
    const source = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const start = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");
    const printMarkup = readFileSync(new URL("./ReceiptView.tsx", import.meta.url), "utf8");
    expect(start).toContain("installViewportGestureGuard()");
    expect(source).toContain('className="modal product-modal stable-product-modal"');
    expect(source).toContain('className="product-form-scroll"');
    expect(source).toContain('className="modal ticket-modal stable-ticket-modal"');
    expect(source).toContain('className="ticket-modal-scroll"');
    expect(css).toContain(".stable-product-modal>.product-form-scroll{");
    expect(css).toContain(".stable-ticket-modal>.ticket-modal-scroll{");
    expect(css).toContain("overflow-wrap:anywhere;");
    expect(css).toContain(".table-wrap table{");
    expect(css).toContain("table-layout:fixed;");
    expect(css).toContain(".ticket-table td:first-child{");
    expect(css).toContain("overscroll-behavior-x:none;");
    expect(css).toContain("overscroll-behavior-y:none;");
    expect(css).toContain("touch-action:pan-y;");
    expect(printMarkup).toContain("item.name");
    expect(css).not.toContain("transform:translateY(-2px)");
    expect(css).not.toContain("transform:translateY(-1px)");
  });

});
