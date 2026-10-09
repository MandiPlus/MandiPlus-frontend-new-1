export const MIN_DESKTOP_CREATION_WIDTH = 1024;

export type DesktopCreationBlockReason =
  | "phone"
  | "tablet"
  | "small-workspace";

export type DesktopCreationAccess = {
  allowed: boolean;
  reason: DesktopCreationBlockReason | null;
};

export type DeviceNavigatorSignals = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentData?: {
    mobile?: boolean;
  };
};

type DesktopCreationAccessInput = {
  navigator: DeviceNavigatorSignals;
  viewportWidth: number;
};

const PHONE_USER_AGENT =
  /Android.*Mobile|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini|Windows Phone|Mobi/i;
const TABLET_USER_AGENT = /iPad|Tablet|PlayBook|Silk/i;

export function detectMobileDeviceType(
  navigatorSignals: DeviceNavigatorSignals,
): "phone" | "tablet" | null {
  const userAgent = String(navigatorSignals.userAgent || "");
  const platform = String(navigatorSignals.platform || "");
  const maxTouchPoints = Number(navigatorSignals.maxTouchPoints || 0);

  // iPadOS can request a desktop site and identify itself as macOS. Multiple
  // touch points distinguish it from a Mac without blocking touch laptops.
  const isIPadDesktopMode =
    (/Macintosh/i.test(userAgent) || /MacIntel/i.test(platform)) &&
    maxTouchPoints > 1;
  const isAndroidTablet =
    /Android/i.test(userAgent) && !/Mobile/i.test(userAgent);

  if (
    isIPadDesktopMode ||
    isAndroidTablet ||
    TABLET_USER_AGENT.test(userAgent)
  ) {
    return "tablet";
  }

  if (
    navigatorSignals.userAgentData?.mobile === true ||
    PHONE_USER_AGENT.test(userAgent)
  ) {
    return "phone";
  }

  return null;
}

export function evaluateDesktopCreationAccess({
  navigator,
  viewportWidth,
}: DesktopCreationAccessInput): DesktopCreationAccess {
  const deviceType = detectMobileDeviceType(navigator);
  if (deviceType) {
    return { allowed: false, reason: deviceType };
  }

  if (
    !Number.isFinite(viewportWidth) ||
    viewportWidth < MIN_DESKTOP_CREATION_WIDTH
  ) {
    return { allowed: false, reason: "small-workspace" };
  }

  return { allowed: true, reason: null };
}

export function isIOSSafariUserAgent(userAgent: string): boolean {
  return (
    /iPad|iPhone|iPod/i.test(userAgent) &&
    /WebKit/i.test(userAgent) &&
    /Safari/i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent)
  );
}
