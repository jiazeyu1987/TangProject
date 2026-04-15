/**
 * @typedef {Object} SimulationScenario
 * @property {string} name
 * @property {string} startDate
 * @property {number} days
 * @property {number} basePort
 * @property {{role: "manager"|"supervisor"|"specialist", count: number}[]} roster
 * @property {{maxActionsPerTurn: number, roundsPerDay: number}} turnBudget
 * @property {Object} scorecards
 * @property {{provider: string, name: string, temperature: number}} model
 * @property {{screenshotsPerTurn: number, recordTrace: boolean}} artifactPolicy
 */

/**
 * @typedef {Object} RunManifest
 * @property {string} runId
 * @property {string} scenarioName
 * @property {string} baseUrl
 * @property {string} clockFile
 * @property {Object[]} accounts
 * @property {string} startAt
 * @property {string | null} endAt
 * @property {string} status
 */

/**
 * @typedef {Object} TurnEvent
 * @property {string} simDate
 * @property {"manager"|"supervisor"|"specialist"} role
 * @property {string} account
 * @property {number} turnIndex
 * @property {string} actionType
 * @property {Object} actionArgs
 * @property {string} pageSummary
 * @property {boolean} stateChanged
 * @property {Object} scoreDelta
 * @property {string[]} artifactRefs
 * @property {string} error
 */

export {};
