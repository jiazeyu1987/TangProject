(function initTabRenderUtils() {
  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function resolveActiveMainTab(activeTab, buttons) {
    const safeButtons = toArray(buttons);
    const normalized = String(activeTab || "");
    if (safeButtons.some((button) => button?.dataset?.tab === normalized)) {
      return normalized;
    }
    return "entry";
  }

  function applyMainTabs(activeTab, buttons, panels) {
    const safeButtons = toArray(buttons);
    const safePanels = toArray(panels);
    for (const button of safeButtons) {
      button.classList.toggle("is-active", button.dataset.tab === activeTab);
    }
    for (const panel of safePanels) {
      panel.hidden = panel.dataset.panel !== activeTab;
    }
  }

  function applyLedgerSubTabs({
    activeLedgerSubTab,
    listTabButton,
    detailTabButton,
    projectList,
    projectDetail,
    subtabCopy,
  }) {
    const subtabCopyMap = {
      list: "按医院项目集中查看当前阶段、任务状态、问题标签与最新推进摘要",
      detail: "查看单个医院项目的关键联系人、历史更新、上级留言与当前推进计划",
    };

    for (const button of [listTabButton, detailTabButton]) {
      if (!button) {
        continue;
      }
      const isActive = button.dataset.ledgerSubtab === activeLedgerSubTab;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      button.setAttribute("tabindex", isActive ? "0" : "-1");
    }

    if (projectList) {
      projectList.hidden = activeLedgerSubTab !== "list";
    }
    if (projectDetail) {
      projectDetail.hidden = activeLedgerSubTab !== "detail";
    }
    if (subtabCopy) {
      subtabCopy.textContent = subtabCopyMap[activeLedgerSubTab] || "";
    }
  }

  window.TabRenderUtils = {
    resolveActiveMainTab,
    applyMainTabs,
    applyLedgerSubTabs,
  };
})();
