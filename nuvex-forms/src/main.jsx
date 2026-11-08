import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

try {
  const mode = localStorage.getItem("nf.mode");
  if (mode === "dark" || mode === "light") document.documentElement.dataset.theme = mode;
} catch { /* ignore */ }

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
