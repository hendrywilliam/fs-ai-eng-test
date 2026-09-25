import { applyTestEnv } from './test-env.js';

// Vitest runs setup files before importing any spec, so the environment is
// populated before app.module.ts (and therefore ConfigModule.forRoot) is
// evaluated.
applyTestEnv();
