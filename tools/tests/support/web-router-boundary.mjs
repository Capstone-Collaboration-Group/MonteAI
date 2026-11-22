import React, { useCallback, useEffect } from "react";
import { MemoryRouter, useLocation, useNavigate as actualUseNavigate } from "real:react-router-dom";
import { runtime } from "./web-runtime-mocks.mjs";
export * from "real:react-router-dom";

function PathObserver() {
  const location = useLocation();
  useEffect(() => { runtime.currentPath = location.pathname; }, [location]);
  return null;
}
// Only browser-history/DOM ownership is replaced; real router matching,
// Navigate, Outlet, and navigation run against an in-memory history.
export function BrowserRouter({ children }) {
  return React.createElement(MemoryRouter, { initialEntries: [runtime.route] },
    React.createElement(PathObserver), children);
}
export function useNavigate() {
  const navigate = actualUseNavigate();
  return useCallback((path, options) => {
    runtime.navigation.push([path, options?.replace ?? false]);
    navigate(path, options);
  }, [navigate]);
}
