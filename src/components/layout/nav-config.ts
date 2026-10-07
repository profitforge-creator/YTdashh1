import {
  BarChart3, Briefcase, Hammer, Home, MessageSquare, Newspaper, Trophy, User, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const MOBILE_NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/build", label: "Build", icon: Hammer },
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/work", label: "Work", icon: Briefcase },
  { href: "/profile", label: "Profile", icon: User },
];

export const DESKTOP_NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/build", label: "Build Center", icon: Hammer },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/work", label: "Work", icon: Briefcase },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
