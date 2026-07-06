export const TYPE_LABELS: Record<string, string> = {
  school: "School",
  csr_general: "CSR",
  csr_stem: "CSR - STEM",
  csr_financial_literacy: "CSR - Financial Literacy",
  csr_future_makers: "CSR - Future Makers",
  birthday: "Birthday",
  workshop: "Workshop",
  summer_camp: "Summer Camp",
  ticketed_museum: "Ticketed Museum",
  collaboration: "Collaboration",
};

export const TYPE_COLORS: Record<string, string> = {
  school: "#475569",
  csr_general: "#EA580C",
  csr_stem: "#EA580C",
  csr_financial_literacy: "#EA580C",
  csr_future_makers: "#EA580C",
  birthday: "#EC4899",
  workshop: "#0D9488",
  summer_camp: "#D97706",
  ticketed_museum: "#3B82F6",
  collaboration: "#0D9488",
};

export const SLOT_COLORS: Record<string, string> = {
  blue: "#3B82F6",
  green: "#10B981",
  purple: "#8B5CF6",
  yellow: "#F59E0B",
};

/** Fixed public slots — presets that fill slot times + colour. */
export const SLOT_PRESETS = [
  { label: "10 AM (Blue)", start: "10:00", end: "13:00", color: "blue" },
  { label: "2 PM (Green)", start: "14:00", end: "17:00", color: "green" },
  { label: "4 PM (Purple)", start: "16:00", end: "19:00", color: "purple" },
  { label: "Flexi (Yellow)", start: "10:00", end: "19:00", color: "yellow" },
];

export const DEPARTMENTS = [
  "housekeeping",
  "it",
  "front_desk",
  "security",
  "technical",
  "fnb",
  "ops",
  "visitor_experience",
];

export const ROLES = ["admin", "ops_poc", "sales", "floor_lead", "department_head", "viewer"];

export function dateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    weekday: "long",
  });
}

export function prettyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDate();
  const suffix = [1, 21, 31].includes(day) ? "st" : [2, 22].includes(day) ? "nd" : [3, 23].includes(day) ? "rd" : "th";
  return `${day}${suffix} ${d.toLocaleDateString("en-IN", { month: "long" })} ${d.getFullYear()}`;
}
