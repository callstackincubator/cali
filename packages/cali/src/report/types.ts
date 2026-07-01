import type { CaliContext, CommandId, ToolTraceEntry } from '../runtime/types.js'

export type ResultStatus = 'passed' | 'failed' | 'blocked' | 'not_tested' | 'unsure'

export type ScreenshotInfo = {
  fileName: string
  absolutePath?: string
  bytes: number
  label: string
  blobUrl?: string
  blobDownloadUrl?: string
  blobPathname?: string
  uploadError?: string
}

export type ReportPublisherResult = {
  publisher: string
  status: 'ok' | 'skipped' | 'failed'
  detail?: string
}

export type BaseCommandReport = {
  command: CommandId
  generatedAt: string
  model: string
  context: CaliContext
  overallStatus: ResultStatus
  summary: string
  nextSteps?: string[]
  environmentNotes?: string[]
  publisherResults?: ReportPublisherResult[]
}

export type QaReportInput = {
  overallStatus: ResultStatus
  summary: string
  checked?: string[]
  issues?: string[]
  nextSteps?: string[]
  environmentNotes?: string[]
}

export type QaReport = BaseCommandReport & {
  command: 'qa'
  checked: string[]
  issues: string[]
  nextSteps?: string[]
  screenshots: ScreenshotInfo[]
  acceptanceCriteriaUsed: string[]
  environmentNotes?: string[]
  agentDeviceTrace: ToolTraceEntry[]
}

export type ReviewFinding = {
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  body: string
  file?: string
  lineStart?: number
  lineEnd?: number
}

export type ReviewReportInput = {
  overallStatus: ResultStatus
  summary: string
  findings?: ReviewFinding[]
  strengths?: string[]
  validationGaps?: string[]
  nextSteps?: string[]
  environmentNotes?: string[]
}

export type ReviewReport = BaseCommandReport & {
  command: 'review'
  findings: ReviewFinding[]
  strengths: string[]
  validationGaps: string[]
  nextSteps?: string[]
  environmentNotes?: string[]
}

export type PerfEvidence = {
  kind: 'component' | 'profile' | 'screenshot' | 'note'
  label: string
  detail: string
  reference?: string
}

export type PerfComponentFinding = {
  label: string
  detail: string
}

export type PerfReviewReportInput = {
  overallStatus: ResultStatus
  summary: string
  scenario?: string
  slowComponents?: PerfComponentFinding[]
  rerenderHotspots?: PerfComponentFinding[]
  suspectedCauses?: string[]
  evidence?: PerfEvidence[]
  recommendedFixes?: string[]
  nextSteps?: string[]
  environmentNotes?: string[]
}

export type PerfReviewReport = BaseCommandReport & {
  command: 'perf-review'
  scenario: string
  slowComponents: PerfComponentFinding[]
  rerenderHotspots: PerfComponentFinding[]
  suspectedCauses: string[]
  evidence: PerfEvidence[]
  recommendedFixes: string[]
  nextSteps?: string[]
  environmentNotes?: string[]
  screenshots: ScreenshotInfo[]
  agentDeviceTrace: ToolTraceEntry[]
  reactDevtoolsTrace: ToolTraceEntry[]
}

export type DevReportInput = {
  overallStatus: ResultStatus
  summary: string
  filesChanged?: string[]
  validationsRun?: string[]
  followUps?: string[]
  patchStatus?: 'applied' | 'planned' | 'blocked' | 'partial'
  nextSteps?: string[]
  environmentNotes?: string[]
}

export type DevReport = BaseCommandReport & {
  command: 'dev'
  filesChanged: string[]
  validationsRun: string[]
  followUps: string[]
  patchStatus: 'applied' | 'planned' | 'blocked' | 'partial'
  nextSteps?: string[]
  environmentNotes?: string[]
}

export type CommandReport = QaReport | ReviewReport | PerfReviewReport | DevReport
