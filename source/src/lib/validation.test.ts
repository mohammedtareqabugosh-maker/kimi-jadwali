import { describe, expect, it } from 'vitest'
import { createSeedData } from '../data/seed'
import { validateBackup } from './validation'

describe('التحقق من النسخ الاحتياطية', () => {
  it('يقبل نسخة التطبيق الصالحة ويحافظ على محتواها', () => {
    const data = createSeedData()
    const restored = validateBackup(JSON.parse(JSON.stringify(data)))
    expect(restored.tasks).toHaveLength(data.tasks.length)
    expect(restored.settings.streakTarget).toBe(data.settings.streakTarget)
  })
  it('يرفض ملفًا تالفًا أو وقتًا غير صالح قبل الاستيراد', () => {
    expect(() => validateBackup({ tasks: [] })).toThrow()
    const data = createSeedData()
    data.tasks.push({ id: 'invalid-time', day: 0, start: '99:99', end: '10:00', title: 'وقت غير صالح', type: 'study', notes: '', fixed: false, allowSplit: false, countsTowardsProgress: true })
    expect(() => validateBackup(data)).toThrow()
  })
})
