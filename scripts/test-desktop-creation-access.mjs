import assert from "node:assert/strict";

import {
  MIN_DESKTOP_CREATION_WIDTH,
  detectMobileDeviceType,
  evaluateDesktopCreationAccess,
} from "../src/shared/device/desktopCreationAccess.ts";
import { resolveInsuranceCreationAudience } from "../src/features/insurance/creationAccessPolicy.ts";

const iphoneSafari = {
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  platform: "iPhone",
  maxTouchPoints: 5,
};
assert.equal(detectMobileDeviceType(iphoneSafari), "phone");

const androidPhone = {
  userAgent:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36",
  platform: "Linux armv8l",
  maxTouchPoints: 5,
};
assert.equal(detectMobileDeviceType(androidPhone), "phone");

const ipadSafari = {
  userAgent:
    "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  platform: "iPad",
  maxTouchPoints: 5,
};
assert.equal(detectMobileDeviceType(ipadSafari), "tablet");

const ipadDesktopMode = {
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
  platform: "MacIntel",
  maxTouchPoints: 5,
};
assert.equal(detectMobileDeviceType(ipadDesktopMode), "tablet");

const androidTablet = {
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
  platform: "Linux armv8l",
  maxTouchPoints: 10,
};
assert.equal(detectMobileDeviceType(androidTablet), "tablet");

const windowsTouchLaptop = {
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
  platform: "Win32",
  maxTouchPoints: 10,
  userAgentData: { mobile: false },
};
assert.equal(detectMobileDeviceType(windowsTouchLaptop), null);
assert.deepEqual(
  evaluateDesktopCreationAccess({
    navigator: windowsTouchLaptop,
    viewportWidth: 1440,
  }),
  { allowed: true, reason: null },
);

assert.deepEqual(
  evaluateDesktopCreationAccess({
    navigator: windowsTouchLaptop,
    viewportWidth: MIN_DESKTOP_CREATION_WIDTH - 1,
  }),
  { allowed: false, reason: "small-workspace" },
);

assert.deepEqual(
  evaluateDesktopCreationAccess({
    navigator: iphoneSafari,
    viewportWidth: 1366,
  }),
  { allowed: false, reason: "phone" },
  "Desktop-mode width must not allow a phone.",
);

assert.deepEqual(
  resolveInsuranceCreationAudience({
    user: { identity: "CUSTOMER" },
    hasDirectAdminSession: false,
    hasAdminActorSession: false,
  }),
  { isPrivilegedActor: false, usesInternalFlow: false },
);

assert.deepEqual(
  resolveInsuranceCreationAudience({
    user: { identity: "INTERNAL_TEAM" },
    hasDirectAdminSession: false,
    hasAdminActorSession: false,
  }),
  { isPrivilegedActor: true, usesInternalFlow: true },
);

assert.deepEqual(
  resolveInsuranceCreationAudience({
    user: { identity: "CUSTOMER" },
    hasDirectAdminSession: false,
    hasAdminActorSession: true,
  }),
  { isPrivilegedActor: true, usesInternalFlow: false },
  "An impersonating admin is blocked on mobile but keeps the customer flow on desktop.",
);

assert.deepEqual(
  resolveInsuranceCreationAudience({
    user: null,
    hasDirectAdminSession: true,
    hasAdminActorSession: true,
  }),
  { isPrivilegedActor: true, usesInternalFlow: true },
);

console.log("Desktop creation access checks passed.");
