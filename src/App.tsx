import { Suspense, lazy } from "react";
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

/**
 * Two pages, one of which is not shipped, so there is no router.
 *
 * A routing library was 80 kB of the bundle to answer a question one
 * comparison answers. The route a rider builds lives in the query string and is
 * read by the page itself, so nothing here needs to watch it either.
 */
export function App() {
  if (AdminPage && window.location.pathname.startsWith("/admin")) {
    return (
      <Suspense fallback={null}>
        <AdminPage />
      </Suspense>
    );
  }
  return <MapPage />;
}
