import { Navigate, Outlet } from "react-router-dom";
import { BaseLayout } from "../layout/base-layout";

export const ProtectedRoute = () => {
  const token = localStorage.getItem("accessToken");
  const isAuthenticated = !!token;

  return isAuthenticated ? (
    <BaseLayout>
      <Outlet />
    </BaseLayout>
  ) : (
    <Navigate to="/login" />
  );
};
