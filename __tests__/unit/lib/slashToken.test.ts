import { applySkill, findSlashToken, isSkillIntact, rankSkills, type SkillEntry } from '@/lib/slashToken'

const skill = (name: string, description = ''): SkillEntry => ({ name, description, source: 'user' })

describe('findSlashToken', () => {
  it('opens on a slash at the start of the prompt', () => {
    expect(findSlashToken('/', 1)).toEqual({ start: 0, end: 1, query: '' })
    expect(findSlashToken('/td', 3)).toEqual({ start: 0, end: 3, query: 'td' })
  })

  it('queries up to the cursor and spans the whole first word', () => {
    expect(findSlashToken('/tdd rest', 2)).toEqual({ start: 0, end: 4, query: 't' })
  })

  it('stays closed past the first word, before the slash, or off the start', () => {
    expect(findSlashToken('/tdd rest', 6)).toBeNull()
    expect(findSlashToken('/tdd', 0)).toBeNull()
    expect(findSlashToken('fix /tdd', 8)).toBeNull()
    expect(findSlashToken(' /tdd', 5)).toBeNull()
    expect(findSlashToken('', 0)).toBeNull()
  })

  it('stays closed when a range is selected (cursor -1)', () => {
    expect(findSlashToken('/tdd', -1)).toBeNull()
  })
})

describe('rankSkills', () => {
  const skills = [skill('review-kit:lint', 'Lint the diff'), skill('tdd', 'Test first'), skill('lint')]

  it('lists everything in order for an empty query', () => {
    expect(rankSkills(skills, '').map((s) => s.name)).toEqual(['review-kit:lint', 'tdd', 'lint'])
  })

  it('puts name prefixes before substrings before description matches, case-insensitively', () => {
    expect(rankSkills(skills, 'LI').map((s) => s.name)).toEqual(['lint', 'review-kit:lint'])
    expect(rankSkills(skills, 'first').map((s) => s.name)).toEqual(['tdd'])
    expect(rankSkills(skills, 'zzz')).toEqual([])
  })

  it('ranks a name substring above a description match, whatever the list order', () => {
    const list = [skill('notes', 'Write lint notes'), skill('eslint')]
    expect(rankSkills(list, 'lint').map((s) => s.name)).toEqual(['eslint', 'notes'])
  })

    it('caps the result', () => {
    expect(rankSkills(skills, '', 2)).toHaveLength(2)
  })
})

describe('applySkill', () => {
  it('replaces the slash token with the bare name and a space', () => {
    const token = findSlashToken('/td', 3)!
    expect(applySkill('/td', token, skill('tdd'))).toEqual({ text: 'tdd ', cursor: 4 })
  })

  it('keeps the rest of the prompt without doubling the space', () => {
    const token = findSlashToken('/t add tests', 2)!
    expect(applySkill('/t add tests', token, skill('tdd'))).toEqual({ text: 'tdd add tests', cursor: 4 })
  })
})

describe('isSkillIntact', () => {
  it('holds while the name at the start is untouched', () => {
    expect(isSkillIntact('tdd', 'tdd')).toBe(true)
    expect(isSkillIntact('tdd add tests', 'tdd')).toBe(true)
  })

  it('breaks when any character of the name changes', () => {
    expect(isSkillIntact('td add tests', 'tdd')).toBe(false)
    expect(isSkillIntact('tddadd', 'tdd')).toBe(false)
    expect(isSkillIntact('xtdd ', 'tdd')).toBe(false)
    expect(isSkillIntact('', 'tdd')).toBe(false)
  })
})
