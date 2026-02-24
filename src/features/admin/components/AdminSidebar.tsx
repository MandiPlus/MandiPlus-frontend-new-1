'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
    FolderIcon,
    HomeIcon,
    UsersIcon,
    XMarkIcon,
    ClipboardDocumentListIcon,
    PencilSquareIcon,
    BanknotesIcon,
    CreditCardIcon,
    MapPinIcon
} from '@heroicons/react/24/outline';
import { Bars3Icon } from '@heroicons/react/16/solid';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdmin } from '../context/AdminContext';

// Updated Navigation List
const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: HomeIcon },
    { name: 'Users', href: '/admin/users', icon: UsersIcon },
    { name: 'Invoice / Insurance Forms', href: '/admin/insurance-forms', icon: FolderIcon },
    { name: 'Claim Requests', href: '/admin/claims', icon: ClipboardDocumentListIcon },
    { name: 'Tracking', href: '/admin/tracking', icon: MapPinIcon },
    { name: 'Created Trips', href: '/admin/trips', icon: MapPinIcon },
    { name: 'Agent Commissions', href: '/admin/agent-commissions', icon: BanknotesIcon },
    { name: 'Insurance Payments', href: '/admin/insurance-payments', icon: CreditCardIcon },
    {
    name: 'Edit Insurance PDF',
    href: '/admin/pdf-editor',
    icon: PencilSquareIcon,
},
];

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

export default function AdminSidebar() {
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { logout } = useAdmin();

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
                                    <div className="mt-5 h-0 flex-1 overflow-y-auto">
                                        <nav className="space-y-1 px-2">
                                            {navigation.map((item) => {
                                                const isActive = pathname === item.href;

                                                return (
                                                    <Link
                                                        key={item.name}
                                                        href={item.href}
                                                        className={classNames(
                                                            isActive
                                                                ? 'bg-[#4309ac]/10 text-[#4309ac]'
                                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                                                            'group flex items-center rounded-md px-2 py-2 text-base font-medium'
                                                        )}
                                                        onClick={() => setSidebarOpen(false)} // Close drawer on link click
                                                    >
                                                        <item.icon
                                                            className={classNames(
                                                                isActive ? 'text-[#4309ac]' : 'text-gray-400 group-hover:text-gray-500',
                                                                'mr-4 h-6 w-6 shrink-0'
                                                            )}
                                                            aria-hidden="true"
                                                        />
                                                        {item.name}

                                                    </Link>
                                                );
                                            })}
                                        </nav>
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
                            <nav className="mt-5 flex-1 space-y-1 bg-white px-2">
                                {navigation.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            className={classNames(
                                                isActive
                                                    ? 'bg-[#4309ac]/10 text-[#4309ac]'
                                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                                                'group flex items-center rounded-md px-2 py-2 text-sm font-medium'
                                            )}
                                        >
                                            <item.icon
                                                className={classNames(
                                                    isActive ? 'text-[#4309ac]' : 'text-gray-400 group-hover:text-gray-500',
                                                    'mr-3 h-6 w-6 shrink-0'
                                                )}
                                                aria-hidden="true"
                                            />
                                            {item.name}

                                        </Link>
                                    );
                                })}
                            </nav>
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
