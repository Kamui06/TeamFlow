export const getRole = (): string | null => localStorage.getItem("role");

export const isAdmin = (): boolean => getRole() === "ADMIN";