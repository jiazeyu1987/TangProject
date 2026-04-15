(function initContactEditorUtils() {
  function toContactDraftRows(contacts) {
    return (Array.isArray(contacts) ? contacts : []).map((contact) => ({
      id: String(contact?.id || ""),
      name: String(contact?.name || ""),
      roleTitle: String(contact?.roleTitle || ""),
    }));
  }

  function normalizeContactDraftRows(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      id: String(row?.id || "").trim(),
      name: String(row?.name || "").trim(),
      roleTitle: String(row?.roleTitle || "").trim(),
    }));
  }

  function validateContactDraftRows(rows) {
    const normalizedRows = validateDistinctContactDraftRows(rows);
    for (const row of normalizedRows) {
      const siblings = normalizedRows.filter((item) => item.name.toLowerCase() === row.name.toLowerCase());
      if (siblings.length < 2) {
        continue;
      }
      if (!row.roleTitle) {
        throw new Error(`联系人“${row.name}”同名时，至少要填写角色以便区分`);
      }
    }
    return normalizedRows;
  }

  function validateDistinctContactDraftRows(rows) {
    const exactIdentitySeen = new Set();
    return (Array.isArray(rows) ? rows : []).map((row, index) => {
      const id = String(row?.id || "").trim();
      const name = String(row?.name || "").trim();
      const roleTitle = String(row?.roleTitle || "").trim();
      if (!name) {
        throw new Error(`第 ${index + 1} 行联系人姓名不能为空`);
      }
      const identityKey = `${name.toLowerCase()}::${roleTitle.toLowerCase()}`;
      if (exactIdentitySeen.has(identityKey)) {
        throw new Error(`联系人“${name}”与另一行的姓名、角色完全重复，请先去重再保存`);
      }
      exactIdentitySeen.add(identityKey);
      return { id, name, roleTitle };
    });
  }

  function normalizeContactMergeActions(actions) {
    return (Array.isArray(actions) ? actions : [])
      .map((item) => ({
        sourceContactId: String(item?.sourceContactId || "").trim(),
        targetContactId: String(item?.targetContactId || "").trim(),
        sourceSnapshot: {
          name: String(item?.sourceSnapshot?.name || "").trim(),
          roleTitle: String(item?.sourceSnapshot?.roleTitle || "").trim(),
        },
        targetSnapshot: {
          name: String(item?.targetSnapshot?.name || "").trim(),
          roleTitle: String(item?.targetSnapshot?.roleTitle || "").trim(),
        },
      }))
      .filter((item) => item.sourceContactId || item.targetContactId || item.sourceSnapshot.name || item.targetSnapshot.name);
  }

  function normalizeContactOriginalRows(rows) {
    return (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        id: String(row?.id || "").trim(),
        name: String(row?.name || "").trim(),
        roleTitle: String(row?.roleTitle || "").trim(),
      }))
      .filter((row) => row.id || row.name);
  }

  function generateTempContactId() {
    return `draft-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  window.ContactEditorUtils = {
    toContactDraftRows,
    normalizeContactDraftRows,
    validateContactDraftRows,
    normalizeContactMergeActions,
    normalizeContactOriginalRows,
    generateTempContactId,
  };
})();
