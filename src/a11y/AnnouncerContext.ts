import { createContext, useContext } from "react";
import type { AnnouncementQueue } from "./AnnouncementQueue";

/**
 * React context that gives any component access to the app's announcer
 * without prop-drilling. Set once at the root in App.tsx.
 */
export const AnnouncerContext = createContext<AnnouncementQueue | null>(null);

export function useAnnouncer(): AnnouncementQueue {
  const v = useContext(AnnouncerContext);
  if (!v) throw new Error("AnnouncerContext is not provided");
  return v;
}
