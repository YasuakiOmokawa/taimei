const ALL_COMPANIES = "*";

export const isCompanyAllowed = (
  companyId: string,
  allowedCompanyIds: string | undefined,
) => {
  const ids = (allowedCompanyIds ?? "").split(",").map((id) => id.trim());
  return ids.includes(ALL_COMPANIES) || ids.includes(companyId);
};
