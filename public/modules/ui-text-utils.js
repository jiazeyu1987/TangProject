(function initUiTextUtils() {
  const DISPLAY_TEXT_REPLACERS = [
    {
      pattern: /account or password is incorrect\.?/gi,
      replacement: "账号或密码错误。",
    },
    {
      pattern: /account already exists\.?/gi,
      replacement: "账号已存在。",
    },
    {
      pattern: /name is required\.?/gi,
      replacement: "请输入姓名。",
    },
    {
      pattern: /account is required\.?/gi,
      replacement: "请输入账号。",
    },
    {
      pattern: /password is required\.?/gi,
      replacement: "请输入密码。",
    },
    {
      pattern: /backupDate is required\.?/gi,
      replacement: "请选择备份日期。",
    },
    {
      pattern: /userId is required\.?/gi,
      replacement: "缺少用户标识。",
    },
    {
      pattern: /regionId is required\.?/gi,
      replacement: "请选择所属区域。",
    },
    {
      pattern: /projectId is required\.?/gi,
      replacement: "缺少项目标识。",
    },
    {
      pattern: /hospitalName is required\.?/gi,
      replacement: "请输入医院名称。",
    },
    {
      pattern: /content is required\.?/gi,
      replacement: "请输入内容。",
    },
    {
      pattern: /remarkId is required\.?/gi,
      replacement: "缺少留言标识。",
    },
    {
      pattern: /reply is required\.?/gi,
      replacement: "请输入回复内容。",
    },
    {
      pattern: /reviewedSnapshot is required\.?/gi,
      replacement: "缺少审核后的结构化结果。",
    },
    {
      pattern: /Authentication required\.?/gi,
      replacement: "请先登录。",
    },
    {
      pattern: /User not found\.?/gi,
      replacement: "未找到对应用户。",
    },
    {
      pattern: /Task not found\.?/gi,
      replacement: "未找到对应任务。",
    },
    {
      pattern: /Project for task not found\.?/gi,
      replacement: "未找到任务对应的项目。",
    },
    {
      pattern: /Project for remark not found\.?/gi,
      replacement: "未找到留言对应的项目。",
    },
    {
      pattern: /Project not found\.?/gi,
      replacement: "未找到对应项目。",
    },
    {
      pattern: /Remark not found\.?/gi,
      replacement: "未找到对应留言。",
    },
    {
      pattern: /Hospital already exists\.?/gi,
      replacement: "医院已存在。",
    },
    {
      pattern: /Responses API request timed out after (\d+)ms\.?/gi,
      replacement: (_, timeoutMs) => `模型接口请求超时（${timeoutMs}ms）。`,
    },
    {
      pattern: /Responses API request failed with HTTP (\d+)(?::\s*)?/gi,
      replacement: (_, statusCode) => `模型接口请求失败，HTTP ${statusCode}：`,
    },
    {
      pattern: /Responses API request failed:\s*/gi,
      replacement: "模型接口请求失败：",
    },
    {
      pattern: /Responses API returned unsupported content type:\s*/gi,
      replacement: "模型接口返回了不支持的内容类型：",
    },
    {
      pattern: /Responses API returned an invalid extraction payload\.?/gi,
      replacement: "模型接口返回了无效的结构化结果。",
    },
    {
      pattern: /Responses API returned an unknown issue tag:\s*/gi,
      replacement: "模型接口返回了未知的问题标签：",
    },
    {
      pattern: /Responses API returned next_actions\[(\d+)\] without a title\.?/gi,
      replacement: (_, index) => `模型接口返回的 next_actions[${index}] 缺少标题。`,
    },
    {
      pattern: /Responses API returned no next_actions\.?/gi,
      replacement: "模型接口未返回下一步动作。",
    },
    {
      pattern: /Responses API returned an unknown stage_after_update:\s*/gi,
      replacement: "模型接口返回了未知的更新后阶段：",
    },
    {
      pattern: /Responses API stream body is unavailable\.?/gi,
      replacement: "模型接口流式响应体不可用。",
    },
    {
      pattern: /Responses API returned malformed SSE data\.?/gi,
      replacement: "模型接口返回了格式错误的 SSE 数据。",
    },
    {
      pattern: /Responses API stream completed without output text\.?/gi,
      replacement: "模型接口流式响应结束但未返回输出文本。",
    },
    {
      pattern: /Responses API JSON response did not include output_text\.?/gi,
      replacement: "模型接口 JSON 响应未包含 output_text。",
    },
    {
      pattern: /Responses API returned invalid JSON:\s*/gi,
      replacement: "模型接口返回了无效 JSON：",
    },
    {
      pattern: /Responses API returned an unknown error\.?/gi,
      replacement: "模型接口返回了未知错误。",
    },
    {
      pattern: /Responses API error \(([^)]+)\):\s*/gi,
      replacement: (_, code) => `模型接口错误（${code}）：`,
    },
    {
      pattern: /Responses API error:\s*/gi,
      replacement: "模型接口错误：",
    },
    {
      pattern: /Responses API configured\.?/gi,
      replacement: "模型接口已配置。",
    },
    {
      pattern: /P(\d+)\s+integration test:\s*submit reviewed snapshot with all next actions cancelled\./gi,
      replacement: (_, phaseId) => `P${phaseId} 集成测试：提交审核后的快照，并取消全部下一步动作。`,
    },
    {
      pattern: /\bContact Edit Tester\b/gi,
      replacement: "联系人编辑测试账号",
    },
    {
      pattern: /\bE2E Drag User\b/gi,
      replacement: "端到端拖拽测试用户",
    },
    {
      pattern: /\bAI\s*录入纪要/gi,
      replacement: "智能录入纪要",
    },
    {
      pattern: /\bAI\b/gi,
      replacement: "智能",
    },
    {
      pattern: /\bhigh\b/gi,
      replacement: "高风险",
    },
    {
      pattern: /\bnormal\b/gi,
      replacement: "中风险",
    },
    {
      pattern: /\blow\b/gi,
      replacement: "低风险",
    },
    {
      pattern: /\bmanager\b/gi,
      replacement: "经理",
    },
    {
      pattern: /\bsupervisor\b/gi,
      replacement: "主管",
    },
    {
      pattern: /\bspecialist\b/gi,
      replacement: "专员",
    },
    {
      pattern: /\bTester\b/gi,
      replacement: "测试账号",
    },
    {
      pattern: /\bDrag\b/gi,
      replacement: "拖拽",
    },
    {
      pattern: /\bUser\b/gi,
      replacement: "用户",
    },
    {
      pattern: /\bE2E\b/gi,
      replacement: "端到端测试",
    },
    {
      pattern: /Responses API/gi,
      replacement: "模型接口",
    },
  ];

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function parseDateValue(value) {
    if (!value && value !== 0) {
      return null;
    }
    if (value instanceof Date) {
      const time = value.getTime();
      return Number.isNaN(time) ? null : new Date(time);
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      const fromNumber = new Date(value);
      return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
    }
    const text = String(value || "").trim();
    if (!text) {
      return null;
    }

    const dateOnlyMatch = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]);
      const day = Number(dateOnlyMatch[3]);
      const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
      if (
        parsed.getFullYear() !== year ||
        parsed.getMonth() + 1 !== month ||
        parsed.getDate() !== day
      ) {
        return null;
      }
      return parsed;
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDate(value) {
    const parsed = parseDateValue(value);
    if (!parsed) {
      return "--";
    }
    const year = String(parsed.getFullYear());
    const month = pad2(parsed.getMonth() + 1);
    const day = pad2(parsed.getDate());
    return `${year}.${month}.${day}`;
  }

  function formatDateTime(value) {
    const parsed = parseDateValue(value);
    if (!parsed) {
      return "--";
    }
    const year = String(parsed.getFullYear());
    const month = pad2(parsed.getMonth() + 1);
    const day = pad2(parsed.getDate());
    const hour = pad2(parsed.getHours());
    const minute = pad2(parsed.getMinutes());
    return `${year}.${month}.${day} ${hour}:${minute}`;
  }

  function formatRemarkRatio(repliedCount, totalCount) {
    const replied = Number.isFinite(Number(repliedCount)) ? Math.max(0, Number(repliedCount)) : 0;
    const total = Number.isFinite(Number(totalCount)) ? Math.max(0, Number(totalCount)) : 0;
    const left = String(Math.min(replied, total)).padStart(2, "0");
    const right = String(total).padStart(2, "0");
    return `${left}/${right}`;
  }

  function escapeSelectorValue(value) {
    return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  }

  function formatDateInput(date) {
    return date.toISOString().slice(0, 10);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function applyDisplayTextReplacements(value) {
    return DISPLAY_TEXT_REPLACERS.reduce((current, rule) => current.replace(rule.pattern, rule.replacement), value);
  }

  function normalizeDisplayGarbles(value) {
    let normalized = value.replace(/\uFFFD+/g, "待补录");
    normalized = normalized.replace(/\?{2,}/g, "待补录");
    normalized = normalized.replace(/待补录(?:\s*[\/|、,，;；]\s*待补录)+/g, "待补录");
    normalized = normalized.replace(/待补录(?:\s+待补录)+/g, "待补录");
    if (/^\s*待补录\s*$/.test(normalized)) {
      return "内容待补录";
    }
    return normalized;
  }

  function normalizeDisplayText(value) {
    if (value === null || value === undefined) {
      return "";
    }
    const rawText = String(value);
    if (!rawText) {
      return "";
    }
    const translated = applyDisplayTextReplacements(rawText);
    const normalized = normalizeDisplayGarbles(translated);
    return normalized.replace(/[^\S\r\n]{2,}/g, " ");
  }

  function escapeDisplayHtml(value) {
    return escapeHtml(normalizeDisplayText(value));
  }

  function formatBackupSize(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatWeekday(value) {
    const labels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const index = Number(value);
    return labels[index] || "周一";
  }

  window.UiTextUtils = {
    formatDate,
    formatDateTime,
    formatRemarkRatio,
    escapeSelectorValue,
    formatDateInput,
    escapeHtml,
    normalizeDisplayText,
    escapeDisplayHtml,
    formatBackupSize,
    formatWeekday,
  };
})();
