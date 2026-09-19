import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "../styles.css";
import "./vault.css";
import App from "./App";
import { registerVaultServiceWorker } from "./registerSW";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerVaultServiceWorker();
