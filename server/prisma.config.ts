import { defineConfig } from 'prisma/config';

export default defineConfig({
    schema: 'prisma/schema.prisma',
    datasource: {
        url: process.env.DATABASE_URL || 'postgresql://postgres:bcmQaxDnVtZBzLnvQlwknkEuoWKkPLoG@postgres.railway.internal:5432/railway',
    },
});
