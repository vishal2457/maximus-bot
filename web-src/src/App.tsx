import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "./pages/home/home.page";
import { LogsPage } from "./pages/log-vewer/logs.page";
import { DiscordConfigPage } from "./pages/handle-secrets/handle-secrets.page";

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen items-center justify-center">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/handle-secrets" element={<DiscordConfigPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
