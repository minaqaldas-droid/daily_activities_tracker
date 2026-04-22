export interface ParsedCommentPrefixes {
  hasMoc: boolean
  otherPerformerName: string
  commentBody: string
}

const MOC_PREFIX_REGEX = /^\s*\{MOC\}\s*/i
const OTHER_PERFORMER_PREFIX_REGEX = /^\s*\[([^\]]+)\]\s*/

export function parseCommentPrefixes(value: string | undefined | null): ParsedCommentPrefixes {
  let remaining = (value || '').trim()
  let hasMoc = false
  let otherPerformerName = ''

  if (MOC_PREFIX_REGEX.test(remaining)) {
    hasMoc = true
    remaining = remaining.replace(MOC_PREFIX_REGEX, '')
  }

  const otherMatch = remaining.match(OTHER_PERFORMER_PREFIX_REGEX)
  if (otherMatch) {
    otherPerformerName = otherMatch[1].trim()
    remaining = remaining.replace(OTHER_PERFORMER_PREFIX_REGEX, '')
  }

  return {
    hasMoc,
    otherPerformerName,
    commentBody: remaining.trim(),
  }
}

export function buildCommentWithPrefixes(input: {
  comment: string
  hasMoc: boolean
  otherPerformerName?: string
}) {
  const parts: string[] = []
  const trimmedComment = input.comment.trim()
  const trimmedOtherName = (input.otherPerformerName || '').trim()

  if (input.hasMoc) {
    parts.push('{MOC}')
  }

  if (trimmedOtherName) {
    parts.push(`[${trimmedOtherName}]`)
  }

  if (trimmedComment) {
    parts.push(trimmedComment)
  }

  return parts.join(' ').trim()
}
