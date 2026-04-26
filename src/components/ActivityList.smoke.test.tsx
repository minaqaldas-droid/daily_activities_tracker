import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActivityList } from './ActivityList'

describe('ActivityList smoke test', () => {
  it('renders without crashing for a minimal activity', () => {
    const html = renderToStaticMarkup(
      <ActivityList
        activities={[
          {
            id: '1',
            date: '2026-04-22',
            performer: 'Ahmed',
            system: 'DCS',
            shift: '',
            permitNumber: '',
            instrumentType: '',
            activityType: 'CM',
            tag: '920TT305',
            problem: 'High alarm',
            action: 'Adjusted threshold',
            comments: 'Stable',
          },
        ]}
        onEdit={() => {}}
        onDelete={async () => {}}
      />
    )

    expect(html).toContain('Ahmed')
    expect(html).toContain('920TT305')
  })
})
