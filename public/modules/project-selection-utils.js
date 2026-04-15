(function initProjectSelectionUtils() {
  function getVisibleProjectsByKeyword(projects, keyword) {
    const safeProjects = Array.isArray(projects) ? projects : [];
    const normalizedKeyword = String(keyword || "").trim().toLowerCase();
    if (!normalizedKeyword) {
      return safeProjects;
    }

    return safeProjects.filter((project) => {
      const hospitalName = String(project?.hospital?.name || "");
      const hospitalCity = String(project?.hospital?.city || "");
      const stageName = String(project?.stage?.name || "");
      const haystack = `${hospitalName} ${hospitalCity} ${stageName}`.toLowerCase();
      return haystack.includes(normalizedKeyword);
    });
  }

  function resolveSelectedProjectId(projects, currentSelectedProjectId) {
    const safeProjects = Array.isArray(projects) ? projects : [];
    const selected = String(currentSelectedProjectId || "");
    if (!safeProjects.length) {
      return "";
    }
    const matched = safeProjects.find((project) => String(project?.id || "") === selected);
    return matched ? matched.id : safeProjects[0].id;
  }

  window.ProjectSelectionUtils = {
    getVisibleProjectsByKeyword,
    resolveSelectedProjectId,
  };
})();
