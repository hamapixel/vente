import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { installViewportGestureGuard } from "./viewportStability";

// Bloquer les gestes qui déplacent ou zooment toute la fenêtre sur le pavé tactile.
installViewportGestureGuard();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
