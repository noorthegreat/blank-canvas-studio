type DatingEligibilityUser = {
  email?: string | null;
  email_confirmed_at?: string | null;
};

const STUDENT_DOMAINS = ["uzh.ch", "ethz.ch"];

export const isStudentEmail = (email?: string | null) => {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return false;
  }

  const domain = normalizedEmail.split("@")[1];
  return STUDENT_DOMAINS.some((allowedDomain) => domain === allowedDomain || domain.endsWith(`.${allowedDomain}`));
};

export const canAccessDating = (user?: DatingEligibilityUser | null) => {
  if (!user) return false;
  return isStudentEmail(user.email) && Boolean(user.email_confirmed_at);
};
