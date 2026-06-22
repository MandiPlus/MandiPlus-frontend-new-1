'use client';

import { Fragment, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { Bars3Icon } from '@heroicons/react/16/solid';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdmin } from '../context/AdminContext';
import { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS, AdminNavGroup, AdminNavItem } from '../access';

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

type VisibleAdminNavGroup = AdminNavGroup & {
    items: AdminNavItem[];
};

function GroupedNavigation({
    groups,
    pathname,
    expandedGroupNames,
    onToggleGroup,
    onNavigate,
    itemTextClassName = 'text-sm',
}: {
    groups: VisibleAdminNavGroup[];
    pathname: string;
    expandedGroupNames: string[];
    onToggleGroup: (groupName: string) => void;
    onNavigate?: () => void;
    itemTextClassName?: string;
}) {
    const expandedGroups = new Set(expandedGroupNames);

    return (
        <nav className="space-y-1.5 px-2">
            {groups.map((group) => {
                const isExpanded = expandedGroups.has(group.name);
                const isGroupActive = group.items.some((item) => pathname === item.href);
                return (
                    <div key={group.name} className="rounded-lg">
                        <button
                            type="button"
                            className={classNames(
                                isGroupActive
                                    ? 'bg-[#4309ac]/5 text-slate-950 ring-1 ring-[#4309ac]/10'
                                    : isExpanded
                                    ? 'bg-slate-50 text-slate-900'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                                'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.08em] transition-colors'
                            )}
                            aria-expanded={isExpanded}
                            onClick={() => onToggleGroup(group.name)}
                        >
                            <span className="truncate">{group.name}</span>
                            <ChevronDownIcon
                                className={classNames(
                                    isExpanded ? 'rotate-180' : '',
                                    isGroupActive ? 'text-[#4309ac]/60' : 'text-slate-400',
                                    'h-4 w-4 shrink-0 transition-transform'
                                )}
                                aria-hidden="true"
                            />
                        </button>

                        {isExpanded ? (
                            <div className="mt-1 space-y-0.5 border-l border-slate-200 pl-2 ml-3">
                                {group.items.map((item) => {
                                    const isActive = pathname === item.href;

                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            className={classNames(
                                                isActive
                                                    ? 'bg-[#4309ac]/10 text-[#4309ac] ring-1 ring-[#4309ac]/10'
                                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
                                                'group flex min-h-10 items-center rounded-md px-2.5 py-2 font-medium transition-colors',
                                                itemTextClassName
                                            )}
                                            onClick={onNavigate}
                                        >
                                            <item.icon
                                                className={classNames(
                                                    isActive ? 'text-[#4309ac]' : 'text-slate-400 group-hover:text-slate-600',
                                                    'mr-2.5 h-5 w-5 shrink-0'
                                                )}
                                                aria-hidden="true"
                                            />
                                            <span className="min-w-0 truncate">{item.name}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>
                );
            })}
        </nav>
    );
}

export default function AdminSidebar() {
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { logout, canAccessSection } = useAdmin();
    const navigationGroups = useMemo(() => {
        const visibleItems = ADMIN_NAV_ITEMS.filter((item) => canAccessSection(item.section));
        const itemBySection = new Map(visibleItems.map((item) => [item.section, item]));

        return ADMIN_NAV_GROUPS
            .map((group) => ({
                ...group,
                items: group.sections
                    .map((section) => itemBySection.get(section))
                    .filter((item): item is AdminNavItem => Boolean(item)),
            }))
            .filter((group) => group.items.length > 0);
    }, [canAccessSection]);
    const activeGroupName = navigationGroups.find((group) =>
        group.items.some((item) => item.href === pathname),
    )?.name;
    const [expandedGroupNames, setExpandedGroupNames] = useState<string[]>(() => [
        activeGroupName || 'Overview',
    ]);

    const toggleGroup = (groupName: string) => {
        setExpandedGroupNames((current) =>
            current.includes(groupName)
                ? current.filter((name) => name !== groupName)
                : [...current, groupName],
        );
    };

    return (
        <>
            <div>
                {/* Mobile Sidebar */}
                <Transition.Root show={sidebarOpen} as={Fragment}>
                    <Dialog as="div" className="relative z-40 lg:hidden" onClose={setSidebarOpen}>
                        <Transition.Child
                            as={Fragment}
                            enter="transition-opacity ease-linear duration-300"
                            enterFrom="opacity-0"
                            enterTo="opacity-100"
                            leave="transition-opacity ease-linear duration-300"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
                        </Transition.Child>

                        <div className="fixed inset-0 z-40 flex">
                            <Transition.Child
                                as={Fragment}
                                enter="transition ease-in-out duration-300 transform"
                                enterFrom="-translate-x-full"
                                enterTo="translate-x-0"
                                leave="transition ease-in-out duration-300 transform"
                                leaveFrom="translate-x-0"
                                leaveTo="-translate-x-full"
                            >
                                <Dialog.Panel className="relative flex w-full max-w-xs flex-1 flex-col bg-white pt-5 pb-4">
                                    <Transition.Child
                                        as={Fragment}
                                        enter="ease-in-out duration-300"
                                        enterFrom="opacity-0"
                                        enterTo="opacity-100"
                                        leave="ease-in-out duration-300"
                                        leaveFrom="opacity-100"
                                        leaveTo="opacity-0"
                                    >
                                        <div className="absolute top-0 right-0 -mr-12 pt-2">
                                            <button
                                                type="button"
                                                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                                                onClick={() => setSidebarOpen(false)}
                                            >
                                                <span className="sr-only">Close sidebar</span>
                                                <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </Transition.Child>
                                    <div className="shrink-0 items-center px-4">
                                        <h1 className="text-xl font-extrabold tracking-tight">
                                            <span className="text-slate-900">Mandi</span>
                                            <span className="text-[#4309ac]">Plus</span>
                                        </h1>
                                    </div>
                                    <div className="mt-5 h-0 flex-1 overflow-y-auto pb-2">
                                        <GroupedNavigation
                                            groups={navigationGroups}
                                            pathname={pathname}
                                            expandedGroupNames={expandedGroupNames}
                                            onToggleGroup={toggleGroup}
                                            onNavigate={() => setSidebarOpen(false)}
                                            itemTextClassName="text-base"
                                        />
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                            <div className="w-14 shrink-0" aria-hidden="true">
                                {/* Dummy element to force sidebar to shrink to fit close icon */}
                            </div>
                        </div>
                    </Dialog>
                </Transition.Root>

                {/* Static sidebar for desktop */}
                <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
                    <div className="flex min-h-0 flex-1 flex-col border-r border-gray-200 bg-white">
                        <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
                            <div className="flex shrink-0 items-center px-4">
                                <h1 className="text-xl font-extrabold tracking-tight">
                                    <span className="text-slate-900">Mandi</span>
                                    <span className="text-[#4309ac]">Plus</span>
                                </h1>
                            </div>
                            <div className="mt-5 flex-1 overflow-y-auto bg-white pb-2">
                                <GroupedNavigation
                                    groups={navigationGroups}
                                    pathname={pathname}
                                    expandedGroupNames={expandedGroupNames}
                                    onToggleGroup={toggleGroup}
                                />
                            </div>
                        </div>
                        <div className="flex shrink-0 border-t border-gray-200 p-4">
                            <button
                                onClick={logout}
                                className="group block w-full shrink-0"
                            >
                                <div className="flex items-center">
                                    <div>
                                        <div className="h-8 w-8 rounded-full bg-[#4309ac]/10 flex items-center justify-center">
                                            <span className="text-[#4309ac] font-semibold">A</span>
                                        </div>
                                    </div>
                                    <div className="ml-3 text-left">
                                        <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                                            Admin

                                        </p>
                                        <p className="text-xs font-medium text-gray-500 group-hover:text-gray-700">
                                            Sign out
                                        </p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile sidebar toggle button wrapper (Hidden on desktop) */}
                <div className="flex flex-1 flex-col lg:pl-64">
                    <div className="sticky top-0 z-10 bg-white pl-1 pt-1 sm:pl-3 sm:pt-3 lg:hidden">
                        <button
                            type="button"
                            className="-ml-0.5 -mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#4309ac]"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <span className="sr-only">Open sidebar</span>
                            <Bars3Icon className="h-6 w-6" aria-hidden="true" />

                        </button>

                    </div>
                </div>
            </div>
        </>
    );
}
