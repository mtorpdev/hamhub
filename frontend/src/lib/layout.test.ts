import assert from 'node:assert/strict'
import test from 'node:test'
import { pageShellClass } from './layout'

test('page shell uses most of the viewport on desktop while staying fluid on small screens', () => {
  assert.match(pageShellClass, /lg:w-\[80vw\]/)
  assert.match(pageShellClass, /w-\[calc\(100%-2rem\)\]/)
  assert.match(pageShellClass, /max-w-\[1800px\]/)
  assert.match(pageShellClass, /mx-auto/)
})
