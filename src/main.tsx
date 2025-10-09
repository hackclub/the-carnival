import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./Layout.jsx";
import NotFound from "./components/NotFound.jsx";
import Upgrades from "./components/Upgrades";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="" element={<Layout />}>
          <Route index element={<App />} />
          <Route path="upgrades" element={<Upgrades />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
