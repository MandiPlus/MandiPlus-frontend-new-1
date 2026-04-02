'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  CalendarDays,
  CirclePlus,
  ClipboardList,
  UserRound,
} from 'lucide-react';

const navigation = [
  { name: 'Home', href: '/field', icon: BarChart3 },
  { name: 'Add Lead', href: '/field/add-lead', icon: CirclePlus },
  { name: 'My Leads', href: '/field/my-leads', icon: ClipboardList },
  { name: 'Meetings', href: '/field/meetings', icon: CalendarDays },
  { name: 'Profile', href: '/field/profile', icon: UserRound },
];

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function FieldShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff8ef_0%,#f4f7fb_45%,#eef4f8_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl">
        <aside className="hidden w-72 border-r border-white/70 bg-white/75 px-5 py-6 backdrop-blur lg:flex lg:flex-col">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
              Field Troy
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              Field Operations
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              A mobile-first workspace for survey agents and meeting teams.
            </p>
          </div>

          <nav className="mt-8 space-y-2">
            {navigation.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={joinClasses(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
                    active
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                      : 'text-slate-700 hover:bg-slate-100',
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/70 bg-white/80 px-4 py-4 backdrop-blur sm:px-6 lg:px-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Responsive PWA
                </p>
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                  Built to fit mobile, tablet, and desktop screens
                </h2>
              </div>
              <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                Install-ready shell
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-10 lg:pb-10">
            {children}
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {navigation.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={joinClasses(
                  'flex flex-col items-center rounded-2xl px-2 py-2 text-[11px] font-medium transition',
                  active ? 'bg-slate-900 text-white' : 'text-slate-600',
                )}
              >
                <item.icon className="mb-1 h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

