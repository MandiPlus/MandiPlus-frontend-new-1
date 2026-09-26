"use client";

import { useMemo } from "react";

import { useAuth } from "@/features/auth/context/AuthContext";
import { customerCopy } from "./i18n";

/**
 * The signed-in customer's copy reader, keyed on their saved language.
 * Returns `t`, so a page reads `t("navSupport")` rather than hardcoding
 * one language's phrasing.
 */
export function useCustomerCopy() {
  const { user } = useAuth();
  const language = user?.preferredLanguage;
  return useMemo(() => customerCopy(language), [language]);
}
