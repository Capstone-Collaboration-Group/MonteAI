export const INSTITUTES = [
  "Institute of Computing Studies",
  "Institute of Business and Entrepreneurship",
  "Institute of Teacher Education",
] as const;

export type Institute = (typeof INSTITUTES)[number];
