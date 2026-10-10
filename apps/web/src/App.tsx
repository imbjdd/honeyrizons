import { lazy, Suspense } from "react";
import CityApp from "./city/CityApp";

const Dashboard = lazy(async () => {
  await Promise.all([
    import("./legacy/dashboard.css"),
    import("./legacy/fonts.css"),
  ]);
  return import("./legacy/Dashboard");
});

export default function App() {
  if (window.location.pathname.replace(/\/$/, "") === "/dashboard") {
    return (
      <Suspense fallback={<p>Loading dashboard…</p>}>
        <Dashboard />
      </Suspense>
    );
  }
  return <CityApp />;
}
