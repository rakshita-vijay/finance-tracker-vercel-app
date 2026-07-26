"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "🏠 Home" },
  { href: "/transactions", label: "➕ Add Transactions" },
  { href: "/spending", label: "📊 View Spending" },
  { href: "/reports", label: "📝 Generate Report" },
  { href: "/budget", label: "💰 Change Budget" },
  { href: "/downloads", label: "⬇️ Download Files" },
  { href: "/wipe", label: "🗑️ Wipe Transactions" },
  { href: "/settings", label: "⚙️ Account Settings" },
];

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <div className="sidebar">
      <h2>Main Menu</h2>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          style={{
            background: pathname === l.href ? "rgba(255,255,255,0.08)" : undefined,
          }}
        >
          {l.label}
        </Link>
      ))}
      <div className="divider" />
      <div className="pill" style={{ padding: "0 8px" }}>{email}</div>
    </div>
  );
}
