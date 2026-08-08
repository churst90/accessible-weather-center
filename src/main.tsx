import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { loadClipIndex } from "./audio/data/clipReferenceTable";

const root = document.getElementById("root");
if (!root) throw new Error("Root element missing");

// Clip metadata is fetched, not bundled — see clipReferenceTable.ts.
// Fire and forget: until it lands, clips resolve at "likely" and still play.
void loadClipIndex();

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
