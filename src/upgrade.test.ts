import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import tauri from "../src-tauri/tauri.conf.json";
import pkg from "../package.json";

describe("VestiFlow upgrade compatibility", () => {
  it("uses the approved brand and a new version", () => {
    expect(tauri.productName).toBe("VestiFlow");
    expect(tauri.app.windows[0].title).toBe("VestiFlow");
    expect(pkg.version).toBe(tauri.version);
    expect(tauri.version).toBe("0.2.0");
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
    const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    expect(styles).toContain("html,body,#root{width:100%;max-width:100%;min-width:0;margin:0}");
    expect(styles).toContain("@media(max-width:940px)");
    expect(styles).toContain("@media(max-height:670px)");
    expect(styles).toContain(".sidebar{");
  });
});
