"use client";

import type { CSSProperties, ReactNode } from "react";
import { openMeetLink } from "@/lib/openMeet";

/** Meet join control that keeps Valeo on-screen if the user cancels the app prompt. */
export default function JoinSessionLink({
  href,
  className,
  style,
  children,
  ariaLabel = "Join Session",
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      aria-label={ariaLabel}
      onClick={(e) => openMeetLink(href, e)}
    >
      {children}
    </a>
  );
}
