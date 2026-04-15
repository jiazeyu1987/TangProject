export function buildContactViewEntity({ contact }) {
  return {
    id: contact.id,
    name: contact.name,
    roleTitle: contact.roleTitle || "",
    departmentName: "",
    lastContactAt: contact.lastContactAt || null,
  };
}

export function buildUserViewEntity({
  user,
  normalizeUserRole,
  roleDefinitions,
  getRegionById,
  getUserById,
  isBackupAdminUser,
}) {
  if (!user) {
    return null;
  }
  const role = normalizeUserRole(user.role);
  const roleMeta = roleDefinitions[role];
  const supervisorUserId = role === "specialist" ? user.supervisorUserId || "" : "";
  const supervisor = supervisorUserId ? getUserById(supervisorUserId) : null;

  return {
    id: user.id,
    name: user.name,
    account: user.account || "",
    role,
    roleName: roleMeta?.name || role,
    regionId: user.regionId || "",
    regionName: getRegionById(user.regionId)?.name || "",
    supervisorUserId,
    supervisorName: supervisor?.name || "",
    isBackupAdmin: isBackupAdminUser(user),
  };
}

export function buildProjectRemarkViewEntity({ remark, getUserById }) {
  const fromUser = getUserById(remark.fromUserId);
  const toUser = getUserById(remark.toUserId);
  const replyByUser = getUserById(remark.replyByUserId);
  const readByUser = getUserById(remark.readByUserId);

  return {
    id: remark.id,
    projectId: remark.projectId,
    updateId: remark.updateId || null,
    historySessionId: remark.historySessionId || null,
    historyQuestionId: remark.historyQuestionId || null,
    fromUserId: remark.fromUserId,
    fromUserName: fromUser?.name || "未知上级",
    toUserId: remark.toUserId,
    toUserName: toUser?.name || "未知成员",
    content: remark.content,
    createdAt: remark.createdAt,
    replyContent: remark.replyContent || "",
    replyByUserId: remark.replyByUserId || "",
    replyByUserName: replyByUser?.name || "",
    repliedAt: remark.repliedAt || null,
    readByUserId: remark.readByUserId || "",
    readByUserName: readByUser?.name || "",
    readAt: remark.readAt || null,
    isRead: Boolean(remark.readAt),
    status: remark.replyContent ? "replied" : "pending",
  };
}
