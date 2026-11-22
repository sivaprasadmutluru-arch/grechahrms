import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

test('starter library has complete, unique questions and answers within API limits', () => {
  const sql = readFileSync(new URL('../../hrms/src/main/resources/db/migration/V29__standard_help_faq_library.sql', import.meta.url), 'utf8')
  const pack = JSON.parse(sql.split('$faq_pack$')[1])
  assert.equal(pack.length, 8)
  const questions = pack.flatMap(category => {
    assert.ok(category.title && category.description)
    assert.ok(category.faqs.length > 0)
    return category.faqs
  })
  assert.equal(questions.length, 34)
  assert.equal(new Set(questions.map(faq => faq.question.toLowerCase())).size, questions.length)
  for (const faq of questions) {
    assert.ok(faq.question.length > 0 && faq.question.length <= 255)
    assert.ok(faq.answer.length > 0 && faq.answer.length <= 10000)
  }
  assert.ok(sql.includes('WHERE NOT EXISTS'))
})
