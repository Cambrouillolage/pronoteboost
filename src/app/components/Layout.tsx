import { Outlet } from "react-router";
import { useEffect } from "react";

export function Layout() {
  useEffect(() => {
    // Generate visitor ID if not exists
    let id = localStorage.getItem("pronoteBoost_visitorId");
    if (!id) {
      id = `pb_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem("pronoteBoost_visitorId", id);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#eef2f6]">
      <div className="mx-auto flex w-full max-w-[1400px] justify-end px-4 py-6 sm:px-6">
        <div className="w-full max-w-[320px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
