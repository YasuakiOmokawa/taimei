export const parsePage = (raw: string | null | undefined): number => {
  const page = Number(raw);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
};

export const generatePagination = (
  currentPage: number,
  totalPages: number,
): (number | "...")[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "...", totalPages - 1, totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, 2, "...", totalPages - 2, totalPages - 1, totalPages];
  }

  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
};
