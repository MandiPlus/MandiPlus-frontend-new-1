"use client";

import { useEffect, useState } from "react";

import {
  type DesktopCreationAccess,
  type DeviceNavigatorSignals,
  evaluateDesktopCreationAccess,
} from "@/shared/device/desktopCreationAccess";

type DesktopCreationAccessState = DesktopCreationAccess & {
  ready: boolean;
};

const INITIAL_STATE: DesktopCreationAccessState = {
  allowed: false,
  reason: null,
  ready: false,
};

export function useDesktopCreationAccess(): DesktopCreationAccessState {
  const [access, setAccess] =
    useState<DesktopCreationAccessState>(INITIAL_STATE);

  useEffect(() => {
    const updateAccess = () => {
      const viewportWidth =
        window.innerWidth || document.documentElement.clientWidth || 0;
      const nextAccess = evaluateDesktopCreationAccess({
        navigator: window.navigator as DeviceNavigatorSignals,
        viewportWidth,
      });

      setAccess({ ...nextAccess, ready: true });
    };

    updateAccess();
    window.addEventListener("resize", updateAccess);
    window.addEventListener("orientationchange", updateAccess);

    return () => {
      window.removeEventListener("resize", updateAccess);
      window.removeEventListener("orientationchange", updateAccess);
    };
  }, []);

  return access;
}
