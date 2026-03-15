import { Navigate, Outlet } from "react-router-dom";
import { BaseLayout } from "../layout/base-layout";

export const ProtectedRoute = () => {
  // TODO: Replace with actual authentication check
  const isAuthenticated = true;
  return isAuthenticated ? (
    <BaseLayout>
      <Outlet />
    </BaseLayout>
  ) : (
    <Navigate to="/login" />
  );
};
