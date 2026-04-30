// Role-based color and image mapping
export const roleColorMap: Record<string, { gradient: string; gradientFrom: string; gradientTo: string; gradientVia: string }> = {
  super_admin: {
    gradient: "from-slate-700 to-slate-900",
    gradientFrom: "from-slate-700",
    gradientTo: "to-slate-900",
    gradientVia: "via-slate-800",
  },
  admin: {
    gradient: "from-teal-400 to-teal-600",
    gradientFrom: "from-teal-400",
    gradientTo: "to-teal-600",
    gradientVia: "via-teal-500",
  },
  service: {
    gradient: "from-teal-400 to-teal-600",
    gradientFrom: "from-teal-400",
    gradientTo: "to-teal-600",
    gradientVia: "via-teal-500",
  },
  doctor: {
    gradient: "from-green-400 to-green-600",
    gradientFrom: "from-green-400",
    gradientTo: "to-green-600",
    gradientVia: "via-green-500",
  },
  parent: {
    gradient: "from-purple-400 to-purple-600",
    gradientFrom: "from-purple-400",
    gradientTo: "to-purple-600",
    gradientVia: "via-purple-500",
  },
  receptionist: {
    gradient: "from-cyan-400 to-cyan-600",
    gradientFrom: "from-cyan-400",
    gradientTo: "to-cyan-600",
    gradientVia: "via-cyan-500",
  },
};

export const roleImageMap: Record<string, string> = {
  super_admin: "/src/assets/profile-super-admin.jpg",
  admin: "/src/assets/profile-service.jpg",
  service: "/src/assets/profile-service.jpg",
  doctor: "/src/assets/profile-doctor.jpg",
  parent: "/src/assets/profile-parent.jpg",
  receptionist: "/src/assets/profile-receptionist.jpg",
};

export const getRoleGradient = (role: string | undefined): string => {
  return roleColorMap[role || "parent"]?.gradient || roleColorMap.parent.gradient;
};

export const getRoleImage = (role: string | undefined): string => {
  return roleImageMap[role || "parent"] || roleImageMap.parent;
};

export const getRoleColors = (role: string | undefined) => {
  return roleColorMap[role || "parent"] || roleColorMap.parent;
};
