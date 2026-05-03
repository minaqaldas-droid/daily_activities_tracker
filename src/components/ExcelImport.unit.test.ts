import { applyImportedCommentCheckboxes } from './ExcelImport'
import { type Activity } from '../supabaseClient'
import { type ActivityFieldDefinition } from '../utils/activityFields'

describe('Excel import comment handling', () => {
  it('preserves raw comments while activating matching checkbox fields', () => {
    const importedActivity: Activity = {
      date: '2026-04-03',
      performer: 'Ahmed Mohamed',
      system: 'DCS',
      shift: 'A',
      permitNumber: '',
      instrumentType: '',
      activityType: 'pm',
      tag: '920TT305',
      problem: 'Add H Alarm',
      action: 'Added H Alarm at 100C',
      comments: '{MOC} {Field Name} Keep this marker visible',
      customFields: {},
    }

    const checkboxFields: ActivityFieldDefinition[] = [
      {
        key: 'mocActivity',
        label: 'MOC',
        placeholder: '',
        type: 'checkbox',
        defaultEnabled: true,
        defaultRequired: false,
        defaultOrder: 10,
      },
      {
        key: 'fieldName',
        label: 'Field Name',
        placeholder: '',
        type: 'checkbox',
        defaultEnabled: true,
        defaultRequired: false,
        defaultOrder: 20,
      },
    ]

    const result = applyImportedCommentCheckboxes(importedActivity, checkboxFields)

    expect(result.comments).toBe('{MOC} {Field Name} Keep this marker visible')
    expect(result.customFields?.mocActivity).toBe('true')
    expect(result.customFields?.fieldName).toBe('true')
  })
})
