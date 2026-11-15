// @vitest-environment jsdom
import '../test/setup'
import { waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GoToSection } from '../pages/GoToSection'
import { CLASS_ID, mockApi, renderRoute } from '../test/render'

describe('/learn/go/<section>', () => {
  it.each([['notebook', `/learn/${CLASS_ID}/notebook`], ['progress', `/learn/${CLASS_ID}/progress`], ['path', `/learn/${CLASS_ID}`], ['nope', '/learn']])(
    '%s opens %s in your own class',
    async (section, to) => {
      const { router } = renderRoute(<GoToSection />, { path: '/learn/go/:section', url: `/learn/go/${section}`, api: mockApi() })
      await waitFor(() => expect(router.state.location.pathname).toBe(to))
    },
  )
})
