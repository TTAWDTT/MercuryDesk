import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { bootstrapNativeMobileShell } from "./mobile/runtime";

void bootstrapNativeMobileShell();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
