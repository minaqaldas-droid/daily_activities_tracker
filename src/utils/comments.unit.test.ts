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
})
