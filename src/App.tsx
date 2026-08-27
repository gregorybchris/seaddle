import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MapPage } from "./pages/map-page";

/**
 * The admin exists only in development.
 *
 * `import.meta.env.DEV` is substituted with a literal at build time, so this
 * whole branch — and the dynamic import inside it — is dead code in production
 * and never reaches the bundle. That is the entire security model: there is no
 * admin to protect because there is no admin out there.
 */
const AdminPage = import.meta.env.DEV
  ? lazy(() => import("./admin/admin-page"))
  : null;

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MapPage />} />
        {AdminPage && (
          <Route
            path="/admin"
            element={
              <Suspense fallback={null}>
                <AdminPage />
              </Suspense>
            }
          />
        )}
      </Routes>
    </BrowserRouter>
  );
}
