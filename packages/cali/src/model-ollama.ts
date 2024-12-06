// to make this work:
// 1. Download ollama and install it: https://ollama.com/
// 2. Run `ollama run llama3.2`

import { createOllama } from 'ollama-ai-provider'

const ollama = createOllama({
  baseURL: 'http://localhost:11434/api',
})

const model = ollama('llama3.2:latest')

export default model
