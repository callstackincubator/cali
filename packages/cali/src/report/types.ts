import type { QaRuntimeContext } from '../env/types.js'

export type ResultStatus = 'passed' | 'failed' | 'blocked' | 'not_tested' | 'unsure'

export type ScreenshotLabel = {
  fileName: string
  label: string
}

export type ScreenshotInfo = {
  fileName: string
  absolutePath: string
  bytes: number
  label: string
  blobUrl?: string
  blobDownloadUrl?: string
  blobPathname?: string
  uploadError?: string
}

export type AgentDeviceTraceEntry = {
  command: string
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
}

export type QaReportInput = {
  overallStatus: ResultStatus
  summary: string
  checked?: string[]
  issues?: string[]
  nextSteps?: string[]
  screenshotLabels?: ScreenshotLabel[]
}

export type QaReport = QaReportInput & {
  generatedAt: string
  model: string
  context: QaRuntimeContext
  screenshots: ScreenshotInfo[]
  agentDeviceTrace: AgentDeviceTraceEntry[]
}
