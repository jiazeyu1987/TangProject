import { collectAccessibleUserIdsByRole } from "./visibility-view-utils.js";

export function buildManagementPayloadView({
  currentUser,
  roleDefinitions,
  users,
  normalizeUserRole,
  buildUserView,
  asString,
  isBackupAdminUser,
}) {
  const safeUsers = Array.isArray(users) ? users : [];
  const roleKeys = Object.keys(roleDefinitions || {});
  const accessibleUserIds = collectAccessibleUserIdsByRole({
    currentUser,
    users: safeUsers,
    normalizeUserRole,
    asString,
  });
  const scopedUsers = safeUsers.filter((item) => accessibleUserIds.has(asString(item?.id)));

  const roleCounts = roleKeys.map((code) => ({
    code,
    name: roleDefinitions[code].name,
    rank: roleDefinitions[code].rank,
    count: scopedUsers.filter((item) => normalizeUserRole(item.role) === code).length,
  }));

  const allUsers = [...safeUsers]
    .map((item) => buildUserView(item))
    .filter(Boolean)
    .sort((left, right) => {
      const roleRankDelta = (roleDefinitions[right.role]?.rank || 0) - (roleDefinitions[left.role]?.rank || 0);
      if (roleRankDelta) {
        return roleRankDelta;
      }
      return left.name.localeCompare(right.name, "zh-CN");
    });

  const role = normalizeUserRole(currentUser?.role);
  const visibleUsers = allUsers.filter((item) => accessibleUserIds.has(asString(item.id)));

  return {
    levels: roleCounts,
    visibleUsers,
    canManageUsers: role === "manager",
    canManageBackups: isBackupAdminUser(currentUser),
  };
}
