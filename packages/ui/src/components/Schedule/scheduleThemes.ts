export function getInstituteTheme(institute?: string, isActive?: boolean) {
  const inst = (institute || "").toLowerCase();
  const baseLayout =
    "absolute rounded-md px-2.5 py-1.5 cursor-pointer transition-all overflow-hidden flex flex-col";

  const elevation = isActive
    ? "ring-2 ring-offset-1 ring-offset-surface z-20 shadow-md"
    : "border shadow-sm hover:z-10";

  // 1. ICS - Orange
  if (inst.includes("computing") || inst.includes("ics")) {
    return `${baseLayout} ${elevation} bg-orange-100 border-orange-200 text-orange-900 ${
      isActive ? "ring-orange-400" : "hover:bg-orange-200"
    }`;
  }

  // 2. ITE - Blue
  if (
    inst.includes("teaching") ||
    inst.includes("education") ||
    inst.includes("ite")
  ) {
    return `${baseLayout} ${elevation} bg-blue-100 border-blue-200 text-blue-900 ${
      isActive ? "ring-blue-400" : "hover:bg-blue-200"
    }`;
  }

  // 3. IBE - Yellow
  if (
    inst.includes("business") ||
    inst.includes("entrepreneurship") ||
    inst.includes("ibe")
  ) {
    return `${baseLayout} ${elevation} bg-yellow-100 border-yellow-200 text-yellow-900 ${
      isActive ? "ring-yellow-400" : "hover:bg-yellow-200"
    }`;
  }

  // 4. Default Fallback (Matches the sage green from your screenshot!)
  return `${baseLayout} ${elevation} bg-primary-container border-outline text-on-surface ${
    isActive ? "ring-on-surface" : "hover:bg-primary"
  }`;
}

// Lightweight variant of getInstituteTheme, sized for small month-view chips
// instead of the absolutely-positioned day/week cards. Same institute → same colors.
export function getInstituteChipTheme(institute?: string, isActive?: boolean) {
  const inst = (institute || "").toLowerCase();
  const base =
    "w-full text-left rounded-md px-2 py-1 text-[11px] font-medium leading-tight truncate border transition-transform hover:scale-[1.02]";
  const ring = isActive ? "ring-2 ring-offset-1" : "";

  // 1. ICS - Orange
  if (inst.includes("computing") || inst.includes("ics")) {
    return `${base} ${ring} bg-orange-100 border-orange-200 text-orange-900 ${
      isActive ? "ring-orange-400" : "hover:bg-orange-200"
    }`;
  }

  // 2. ITE - Blue
  if (
    inst.includes("teaching") ||
    inst.includes("education") ||
    inst.includes("ite")
  ) {
    return `${base} ${ring} bg-blue-100 border-blue-200 text-blue-900 ${
      isActive ? "ring-blue-400" : "hover:bg-blue-200"
    }`;
  }

  // 3. IBE - Yellow
  if (
    inst.includes("business") ||
    inst.includes("entrepreneurship") ||
    inst.includes("ibe")
  ) {
    return `${base} ${ring} bg-yellow-100 border-yellow-200 text-yellow-900 ${
      isActive ? "ring-yellow-400" : "hover:bg-yellow-200"
    }`;
  }

  // 4. Default Fallback (sage green)
  return `${base} ${ring} bg-primary-container border-outline text-on-surface ${
    isActive ? "ring-on-surface" : "hover:bg-primary"
  }`;
}