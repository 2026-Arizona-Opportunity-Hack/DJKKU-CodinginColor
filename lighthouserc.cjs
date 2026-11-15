// Lighthouse CI: builds are served by `vite preview` in demo mode (no database), so these are the pages
// anyone can open. Accessibility must stay at 95 or above (the rubric's bar). Used by
// .github/workflows/lighthouse.yml; to try it locally: npm run build, then `npx @lhci/cli autorun`.
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npx vite preview --port 4173 --host 127.0.0.1',
      startServerReadyPattern: 'Local',
      url: ['http://127.0.0.1:4173/', 'http://127.0.0.1:4173/sign-in', 'http://127.0.0.1:4173/learn/explore', 'http://127.0.0.1:4173/review'],
      numberOfRuns: 1,
      settings: { chromeFlags: '--no-sandbox --headless=new' },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.95 }],
      },
    },
  },
}
