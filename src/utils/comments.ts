export interface ParsedCommentPrefixes {
  hasMoc: boolean
  otherPerformerName: string
  checkboxLabels: string[]
  commentBody: string
}

const MOC_PREFIX_REGEX = /^\s*\{MOC\}\s*/i
const LEADING_TOKEN_REGEX = /^\s*(\{[^}]+\}|\[[^\]]+\])\s*/i

export function parseCommentPrefixes(value: string | undefined | null): ParsedCommentPrefixes {
  let remaining = (value || '').trim()
  let hasMoc = false
  let otherPerformerName = ''
  const checkboxLabels: string[] = []

  while (true) {
    const tokenMatch = remaining.match(LEADING_TOKEN_REGEX)
    if (!tokenMatch) {
      break
    }

    const token = tokenMatch[1].trim()
    remaining = remaining.replace(LEADING_TOKEN_REGEX, '')

    if (MOC_PREFIX_REGEX.test(token)) {
      hasMoc = true
      continue
    }

    const otherMatch = token.match(/^\[([^\]]+)\]$/)
    if (otherMatch) {
      otherPerformerName = otherMatch[1].trim()
      continue
    }

    const checkboxMatch = token.match(/^\{([^}]+)\}$/)
    if (checkboxMatch) {
      const label = checkboxMatch[1].trim()
      if (label && !checkboxLabels.some((item) => item.toLowerCase() === label.toLowerCase())) {
        checkboxLabels.push(label)
      }
    }
  }

  return {
    hasMoc,
    otherPerformerName,
    checkboxLabels,
    commentBody: remaining.trim(),
  }
}

export function buildCommentWithPrefixes(input: {
  comment: string
  hasMoc: boolean
  otherPerformerName?: string
  checkboxLabels?: string[]
}) {
  const parts: string[] = []
  const trimmedComment = input.comment.trim()
  const trimmedOtherName = (input.otherPerformerName || '').trim()
  const normalizedCheckboxLabels = (input.checkboxLabels || [])
    .map((label) => label.trim())
    .filter(Boolean)
    .filter((label, index, collection) => collection.findIndex((item) => item.toLowerCase() === label.toLowerCase()) === index)

  if (input.hasMoc) {
    parts.push('{MOC}')
  }

  normalizedCheckboxLabels.forEach((label) => {
    if (label.toLowerCase() !== 'moc') {
      parts.push(`{${label}}`)
    }
  })

  if (trimmedOtherName) {
    parts.push(`[${trimmedOtherName}]`)
  }

  if (trimmedComment) {
    parts.push(trimmedComment)
  }

  return parts.join(' ').trim()
}
