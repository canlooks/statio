import {defineConfig} from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        include: [
            '**/*.test.ts',
            '**/*.test.tsx'
            // 'test/unit/**/*.test.ts',
            // 'test/integration/**/*.test.tsx'
        ]
    }
})
