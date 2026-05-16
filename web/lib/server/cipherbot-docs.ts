import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

type CipherBotDocChunk = {
  id: string
  source: string
  title: string
  content: string
  keywords: string[]
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'do',
  'for',
  'from',
  'how',
  'i',
  'if',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'or',
  'so',
  'the',
  'to',
  'what',
  'when',
  'why',
  'with'
])

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
}

function safeRead(path: string) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

function extractTitle(source: string, content: string) {
  const heading = content
    .split('\n')
    .find((line) => line.trim().startsWith('#'))
    ?.replace(/^#+\s*/, '')
    .trim()

  return heading || source
}

function chunkMarkdown(source: string, content: string): CipherBotDocChunk[] {
  const normalized = content.replace(/\r/g, '')
  const rawSections = normalized
    .split(/\n(?=#{1,3}\s)/)
    .map((section) => section.trim())
    .filter(Boolean)

  const sections = rawSections.length > 0 ? rawSections : [normalized]

  return sections.map((section, index) => {
    const lines = section.split('\n').filter(Boolean)
    const titleLine = lines.find((line) => line.trim().startsWith('#')) || lines[0] || source
    const title = titleLine.replace(/^#+\s*/, '').trim()
    const body = section.trim()

    return {
      id: `${source}-${index + 1}`,
      source,
      title,
      content: body,
      keywords: tokenize(`${source} ${title} ${body}`).slice(0, 40)
    }
  })
}

const repoRoot = resolve(process.cwd(), '..')
const docsRoot = join(repoRoot, 'docs')
const extraDocs = [
  join(repoRoot, 'README.md'),
  resolve(repoRoot, '../FHERC20_docs.md'),
  resolve(repoRoot, '../fhenix_permits.md')
]

function loadDocChunks() {
  const markdownPaths: string[] = []

  for (const entry of readdirSync(docsRoot, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      markdownPaths.push(join(docsRoot, entry.name))
    }
  }

  markdownPaths.push(...extraDocs)

  return markdownPaths.flatMap((filePath) => {
    const content = safeRead(filePath)
    if (!content.trim()) return []
    const source = filePath.replace(`${repoRoot}/`, '')
    const titledContent = content.startsWith('#') ? content : `# ${extractTitle(source, content)}\n\n${content}`
    return chunkMarkdown(source, titledContent)
  })
}

const DOC_CHUNKS = loadDocChunks()

function scoreChunk(chunk: CipherBotDocChunk, question: string) {
  const questionTokens = tokenize(question)
  const normalizedQuestion = normalizeText(question)
  const searchable = `${chunk.source} ${chunk.title} ${chunk.content} ${chunk.keywords.join(' ')}`
  const searchableTokens = new Set(tokenize(searchable))
  let score = 0

  if (normalizedQuestion.includes(normalizeText(chunk.title))) score += 10
  if (normalizedQuestion.includes(normalizeText(chunk.source))) score += 6

  for (const token of questionTokens) {
    if (searchableTokens.has(token)) score += 3
  }

  if (normalizedQuestion.includes('fh erc20') || normalizedQuestion.includes('fherc20')) {
    if (chunk.source.toLowerCase().includes('fherc20')) score += 18
  }

  if (normalizedQuestion.includes('permit')) {
    if (chunk.source.toLowerCase().includes('permit') || normalizeText(chunk.content).includes('permit')) {
      score += 10
    }
  }

  return score
}

export function getRelevantCipherBotDocChunks(question: string, limit = 6) {
  return DOC_CHUNKS
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk, question)
    }))
    .sort((left, right) => right.score - left.score)
    .filter((item) => item.score > 0)
    .slice(0, limit)
    .map((item) => item.chunk)
}
