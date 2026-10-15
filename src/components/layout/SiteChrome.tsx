"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    const root = document.documentElement;
    if (isHome) root.classList.add("snap-home");
    else root.classList.remove("snap-home");
    return () => root.classList.remove("snap-home");
  }, [isHome]);

  return (
    <>
      <Navbar />
      <main id="main" className={isHome ? undefined : "flex-1"}>
        {children}
      </main>
      {!isHome && <Footer />}
    </>
  );
}
