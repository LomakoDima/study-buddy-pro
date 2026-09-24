import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import { getRouter } from "./router";
import "./styles.css";

const container = document.getElementById("root");

if (!container) throw new Error("Root element was not found");

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={getRouter()} />
  </StrictMode>,
);
