import { defineConfig } from 'prisma/config';

// Use Railway internal URL as fallback for build/runtime
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:bcmQaxDnVtZBzLnvQlwknkEuoWKkPLoG@postgres.railway.internal:5432/railway';

export default defineConfig({
    schema: 'prisma/schema.prisma',
    datasource: {
        url: DATABASE_URL,
    },
});
