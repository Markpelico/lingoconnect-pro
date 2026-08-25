import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    // Everything under test is pure logic or a request handler, so there is no
    // need to pay for a DOM environment.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/app/api/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/types/**',
        // Thin wrappers over the Web Speech API. Covering these would mean
        // mocking SpeechRecognition and SpeechSynthesis wholesale, which tests
        // the mock rather than the code. They are exercised by hand in the
        // browser instead; see the verification notes in the README.
        'src/lib/enhanced-speech.ts',
        'src/lib/speech-synthesis.ts',
      ],
      // CI fails if coverage of the logic above regresses.
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
