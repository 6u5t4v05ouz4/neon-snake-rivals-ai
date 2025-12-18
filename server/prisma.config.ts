import { defineConfig } from 'prisma/config';

// Note: DATABASE_URL is validated at runtime in index.ts
// Empty string fallback allows local builds without env var
export default defineConfig({
    schema: 'prisma/schema.prisma',
    datasource: {
        url: process.env.DATABASE_URL || '',
    },
});
