import { defineConfig } from 'drizzle-kit';

// When TURSO_AUTH_TOKEN is set we're talking to a real Turso instance, which
// requires the 'turso' dialect (the only one that exposes authToken). When the
// token is absent we're on a local libsql file (dev or CI), where the 'sqlite'
// dialect works and doesn't demand an empty authToken.
const hasTursoToken = !!process.env.TURSO_AUTH_TOKEN;

export default hasTursoToken
  ? defineConfig({
      schema: './src/db/schema.ts',
      out: './drizzle',
      dialect: 'turso',
      dbCredentials: {
        url: process.env.TURSO_DATABASE_URL || 'file:local.db',
        authToken: process.env.TURSO_AUTH_TOKEN!,
      },
    })
  : defineConfig({
      schema: './src/db/schema.ts',
      out: './drizzle',
      dialect: 'sqlite',
      dbCredentials: {
        url: process.env.TURSO_DATABASE_URL || 'file:local.db',
      },
    });
