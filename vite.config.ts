import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Cargo creates and locks executable files while compiling on Windows.
    // Vite should watch source files, not generated Rust build artifacts.
    watch: {
      ignored: ["**/src-tauri/target/**", "**/target/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
});
