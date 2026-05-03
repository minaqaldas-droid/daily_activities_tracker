import { buildCommentWithPrefixes, parseCommentPrefixes } from './comments'

describe('comments prefixes utilities', () => {
  it('parses MOC and other performer prefixes', () => {
    const parsed = parseCommentPrefixes('{MOC} [Ali Hassan] Replaced sensor and validated range')

    expect(parsed.hasMoc).toBe(true)
    expect(parsed.otherPerformerName).toBe('Ali Hassan')
    expect(parsed.commentBody).toBe('Replaced sensor and validated range')
  })

  it('builds prefixed comments in the expected order', () => {
    const result = buildCommentWithPrefixes({
      hasMoc: true,
      otherPerformerName: 'Ali Hassan',
      comment: 'Replaced sensor and validated range',
    })

    expect(result).toBe('{MOC} [Ali Hassan] Replaced sensor and validated range')
  })

  it('parses custom checkbox prefixes from comments', () => {
    const parsed = parseCommentPrefixes('{MOC} {PAO} {Safety Review} Checked loop')

    expect(parsed.hasMoc).toBe(true)
    expect(parsed.checkboxLabels).toEqual(['PAO', 'Safety Review'])
    expect(parsed.commentBody).toBe('Checked loop')
  })

  it('deduplicates custom checkbox prefixes case-insensitively', () => {
    const result = buildCommentWithPrefixes({
      hasMoc: false,
      checkboxLabels: ['PAO', 'pao', 'Safety Review'],
      comment: 'Done',
    })

    expect(result).toBe('{PAO} {Safety Review} Done')
  })
})
