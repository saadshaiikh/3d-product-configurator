import { BrowserRouter, Routes, Route } from "react-router-dom";

import MainApp from "./pages/MainApp";
import ConfigPage from "./pages/ConfigPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/c/:configId" element={<ConfigPage />} />
      </Routes>
    </BrowserRouter>
  );
}
