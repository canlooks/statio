import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/unit/**/*.test.ts', 'test/integration/**/*.test.tsx'],
        globals: true,
        // React's useSyncExternalStore needs this in Node
        deps: {
            inline: ['react', 'react-dom'],
        },
    },
})
