import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { SpotifyAuthProvider } from "./context/SpotifyAuthContext.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SpotifyAuthProvider>
      <App />
    </SpotifyAuthProvider>
  </StrictMode>
);
