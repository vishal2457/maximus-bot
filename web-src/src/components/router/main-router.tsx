import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./protected-route";
import { PROTECTED_ROUTES, PUBLIC_ROUTES } from "./router-data";

export const MainRouter = () => {
  return (
    <BrowserRouter basename="/web">
      <Routes>
        {PUBLIC_ROUTES.map((route) => {
          const Comp = route.component;
          return (
            <Route key={route.path} path={route.path} element={<Comp />} />
          );
        })}
        <Route element={<ProtectedRoute />}>
          {PROTECTED_ROUTES.map((route) => {
            const Comp = route.component;
            return (
              <Route key={route.path} path={route.path} element={<Comp />} />
            );
          })}
        </Route>

        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
};
