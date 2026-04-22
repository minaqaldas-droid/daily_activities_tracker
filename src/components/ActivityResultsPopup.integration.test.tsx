import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActivityResultsPopup } from './ActivityResultsPopup'

function createActivity(index: number) {
  return {
    id: `activity-${index}`,
    date: `2026-04-${String((index % 28) + 1).padStart(2, '0')}`,
    performer: `Performer ${index}`,
    system: 'DCS',
    activityType: 'PM' as const,
    tag: `TAG-${index}`,
    problem: `Problem ${index}`,
    action: `Action ${index}`,
    comments: `Comments ${index}`,
  }
}

describe('ActivityResultsPopup integration', () => {
  it('renders first page only (default 20 rows) and shows pagination controls', () => {
    const activities = Array.from({ length: 25 }, (_, index) => createActivity(index + 1))

    const html = renderToStaticMarkup(
      <ActivityResultsPopup
        isOpen
        title="Integration Test Popup"
        activities={activities}
        onClose={() => {}}
        onEdit={() => {}}
        onDelete={async () => {}}
      />
    )

    expect(html).toContain('Page 1 of 2')
    expect(html).toContain('Rows')
    expect(html).toContain('Performer 1')
    expect(html).not.toContain('Performer 25')
  })
})
