"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { Sidebar } from "@monteai/ui";
import Navbar from "./Navbar";
import Footer from "./Footer";

interface Section {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface PageSidebarProps {
  sections: readonly Section[];
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showNavbar?: boolean;
  showFooter?: boolean;
}

export function PageSidebar({
  sections,
  title,
  subtitle,
  children,
  showNavbar = true,
  showFooter = true,
}: PageSidebarProps) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? "");
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Navbar is sticky, so its height is constant; measure it live (no hardcoded value)
  const navWrapRef = useRef<HTMLDivElement>(null);
  const [navHeight, setNavHeight] = useState(0);

  useLayoutEffect(() => {
    if (!showNavbar) return;
    const el = navWrapRef.current;
    if (!el) return;

    const update = () => setNavHeight(Math.round(el.getBoundingClientRect().height));
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showNavbar]);

  // Content (and footer) shift to match the fixed sidebar's width on desktop
  const contentOffset = collapsed ? "lg:ml-16" : "lg:ml-64";

  // Scroll spy: look sections up by id once children have rendered
  useEffect(() => {
    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
    setSidebarOpen(false); // no-op on desktop
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    scrollToSection(id);
  };

  return (
    <div
      className="min-h-screen bg-surface"
      style={{ "--nav-h": `${showNavbar ? navHeight : 0}px` } as React.CSSProperties}
    >
      {/* Sticky navbar, same pattern as About.tsx / LandingPage.tsx */}
      {showNavbar && (
        <div ref={navWrapRef} className="sticky top-0 z-50">
          <Navbar />
        </div>
      )}

      {/* Mobile overlay (starts below the navbar) */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-x-0 bottom-0 top-[var(--nav-h)] z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <div className="flex">
        {/* Fixed sidebar pinned right below the sticky navbar */}
        <aside
          id="page-sidebar"
          aria-label={`${title} navigation`}
          className={`fixed left-0 top-[var(--nav-h)] z-30 h-[calc(100dvh-var(--nav-h))] w-64 border-r border-outline-variant/70 bg-surface transition-[transform,width] duration-200
            ${collapsed ? "lg:w-16" : "lg:w-64"}
            ${sidebarOpen ? "visible translate-x-0 z-[45]" : "invisible -translate-x-full"}
            lg:visible lg:translate-x-0`}
        >
          <Sidebar collapsed={collapsed} className="h-full">
            <Sidebar.Header className="gap-2.5 border-b border-outline-variant/70">
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-md font-bold leading-tight text-on-surface">{title}</p>
                  {subtitle && (
                    <p className="truncate text-xs text-on-surface-variant">{subtitle}</p>
                  )}
                </div>
              )}
              <div
                className={`flex items-center ${
                  collapsed ? "mx-auto flex-col gap-1" : "ml-auto gap-1.5"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high lg:hidden"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCollapsed(!collapsed)}
                  className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high lg:flex"
                  aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
                  aria-expanded={!collapsed}
                >
                  {collapsed ? (
                    <ChevronRight className="h-5 w-5" />
                  ) : (
                    <ChevronLeft className="h-5 w-5" />
                  )}
                </button>
              </div>
            </Sidebar.Header>

            <Sidebar.Nav className="flex-1 gap-0.5 overflow-y-auto">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={(e) => handleLinkClick(e, section.id)}
                  aria-current={activeSection === section.id ? "page" : undefined}
                >
                  <Sidebar.Item
                    icon={section.icon}
                    label={section.label}
                    active={activeSection === section.id}
                  />
                </a>
              ))}
            </Sidebar.Nav>
          </Sidebar>
        </aside>

        {/* Margin matches the fixed sidebar's width on desktop */}
        <main className={`min-w-0 flex-1 transition-[margin] duration-200 ${contentOffset}`}>
          {/* Mobile top bar (sticks below the navbar) */}
          <div className="sticky top-[var(--nav-h)] z-20 flex items-center gap-3 border-b border-outline-variant/70 bg-surface/90 px-4 py-2 backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high"
              aria-label="Open navigation menu"
              aria-controls="page-sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-on-surface">{title}</span>
          </div>

          <div className="mx-auto w-full max-w-4xl px-4 py-8 lg:px-8 lg:py-12">
            {children}
          </div>
        </main>
      </div>

      {showFooter && (
        <div className={`transition-[margin] duration-200 ${contentOffset}`}>
          <Footer />
        </div>
      )}
    </div>
  );
}