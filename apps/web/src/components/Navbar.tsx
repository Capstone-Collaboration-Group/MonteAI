"use client";

import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const navItems = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Tutorial", href: "/tutorial" },
  { label: "Download App", href: "/download-app" },
] as const;

const itemVariants = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
};

export default function Navbar() {
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [underlineStyle, setUnderlineStyle] = useState({ width: 0, x: 0 });

  // Calculate underline position for active item
  useEffect(() => {
    const newActive = navItems.find((item) => location.pathname === item.href) ?? navItems[0];

    if (navRef.current) {
      const activeLink = navRef.current.querySelector(`[data-nav-item="${newActive.label}"]`) as HTMLElement;
      if (activeLink) {
        const rect = activeLink.getBoundingClientRect();
        const navRect = navRef.current.getBoundingClientRect();
        setUnderlineStyle({
          width: rect.width,
          x: rect.left - navRect.left,
        });
      }
    }
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-50 w-full bg-surface-container-low/95 backdrop-blur-sm border-b border-outline-variant/50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-3 px-4 py-3 sm:flex-nowrap sm:px-8 sm:py-5 lg:px-10">
        <Link
          to="/"
          className="text-2xl font-black text-primary transition hover:opacity-80 sm:text-3xl"
        >
          MonteSkolar
        </Link>

        <nav
          ref={navRef}
          aria-label="Primary"
          className="order-3 flex w-full items-center justify-center gap-8 sm:order-2 sm:w-auto lg:gap-10 relative"
        >
          {/* Animated underline indicator */}
          <motion.div
            className="absolute bottom-0 left-0 h-0.5 bg-primary rounded-full pointer-events-none"
            initial={{ width: 0, x: 0, opacity: 0 }}
            animate={{ ...underlineStyle, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            style={{ transformOrigin: "left center" }}
          />

          <AnimatePresence mode="wait">
            {navItems.map((item) => (
              <motion.span
                key={item.label}
                initial="initial"
                animate="animate"
                exit="exit"
                variants={itemVariants}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <Link
                  to={item.href}
                  aria-current={location.pathname === item.href ? "page" : undefined}
                  data-nav-item={item.label}
                  className={`relative flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                    location.pathname === item.href
                      ? "text-primary"
                      : "text-on-surface-variant hover:text-primary"
                  }`}
                >
                  {item.label}
                </Link>
              </motion.span>
            ))}
          </AnimatePresence>
        </nav>

        <div className="order-2 flex items-center gap-2 sm:order-3 sm:gap-3">
          <Link
            to="/login"
            className="flex min-w-[68px] items-center justify-center rounded-full border border-primary bg-surface px-3 py-2 text-xs font-semibold text-on-surface shadow-sm transition hover:bg-surface-container-low sm:min-w-[100px] sm:px-5 sm:py-3 sm:text-sm"
          >
            Login
          </Link>

          <Link
            to="/register"
            className="flex min-w-[78px] items-center justify-center rounded-full bg-primary px-3 py-2 text-xs font-semibold text-on-primary shadow-sm transition hover:bg-primary-container sm:min-w-[120px] sm:px-5 sm:py-3 sm:text-sm"
          >
            Register
          </Link>
        </div>
      </div>
    </header>
  );
}