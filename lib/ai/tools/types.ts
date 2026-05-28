import type OpenAI from 'openai'

export interface ToolContext {
  userId: number
}

export interface Tool<TArgs = unknown> {
  /** Definição enviada à OpenAI */
  definition: OpenAI.Chat.Completions.ChatCompletionTool
  /** Executor server-side */
  execute: (args: TArgs, ctx: ToolContext) => Promise<unknown>
}

export type ToolRegistry = Record<string, Tool>
