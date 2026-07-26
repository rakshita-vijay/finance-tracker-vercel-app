import "./globals.css";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "./Sidebar";

export const metadata = {
  title: "Finance Tracker",
  description: "AI-powered personal finance tracker",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        {user ? (
          <div className="layout">
            <Sidebar email={user.email ?? ""} />
            <div className="content">{children}</div>
          </div>
        ) : (
          <div className="content" style={{ maxWidth: 480, margin: "0 auto" }}>
            {children}
          </div>
        )}
      </body>
    </html>
  );
}
