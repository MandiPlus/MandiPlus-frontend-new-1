"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/features/auth/context/AuthContext";

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

const nav = [
  { name: "Dashboard", href: "/agent/dashboard" },
  { name: "Channel Partner", href: "/channel-partner/dashboard" },
];

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-lg font-semibold text-[#4309ac]">Agent Portal</div>
            <nav className="flex items-center gap-2">
              {nav.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={classNames(
                      isActive
                        ? "bg-[#4309ac] text-white"
                        : "text-gray-700 hover:bg-gray-50",
                      "px-3 py-1.5 rounded-md text-sm font-medium",
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              {user?.agentName || user?.name || user?.mobileNumber || "Agent"}
            </div>
            <button
              onClick={logout}
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
