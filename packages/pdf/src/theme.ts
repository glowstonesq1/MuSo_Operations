/** Colour conventions — Section 10 of the spec + fills observed in the
 *  reference Excel files (packages/db docs). Keep these in sync with the UI. */

export const SLOT_COLORS: Record<string, string> = {
  blue: "#3B82F6", // 10 AM
  green: "#10B981", // 2 PM
  purple: "#8B5CF6", // 4 PM
  yellow: "#F59E0B", // Flexi Pass
};

export const TYPE_BADGES: Record<string, string> = {
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

/** Fills used in the reference workbooks */
export const XL = {
  schoolName: "#43AEE2", // blue highlight on school name
  duration: "#FF9900", // orange duration row
  sectionYellow: "#FFFF00", // summary-report section heads
  sessionTime: "#D9E1F2", // light blue session time bands
  labHeader: "#FEF1CC", // pale yellow lab headers
  lunch: "#F8CBAD", // peach lunch band
  switch: "#FAD9D6", // pale red switch band
  memoHeader: "#B7B7B7",
  memoSubHeader: "#CCCCCC",
  memoCell: "#EFEFEF",
  groupsBox: "#D9E7FD",
};

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
