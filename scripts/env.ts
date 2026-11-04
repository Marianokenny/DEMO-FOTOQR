// Loads .env when it exists (local development). In Docker the variables come from the container.
try {
  process.loadEnvFile();
} catch {
  /* no .env file */
}
