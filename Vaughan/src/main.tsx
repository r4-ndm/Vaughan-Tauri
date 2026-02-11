import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

console.log("=== Vaughan Wallet Starting ===");
console.log("React version:", React.version);
console.log("Root element:", document.getElementById("root"));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

console.log("=== React render called ===");
