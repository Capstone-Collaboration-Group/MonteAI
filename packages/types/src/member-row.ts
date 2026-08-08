export interface MemberRow extends Record<string, unknown> {
  id: string;
  name: string;
  email: string;
  role: string;
  institute: string;
  extra: string;
  isActive: boolean;
}