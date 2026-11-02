import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function loadEnv(): void {
  const envFile = path.join(process.cwd(), '.env');
  const envExampleFile = path.join(process.cwd(), '.env.example');

  if (!fs.existsSync(envFile)) {
    console.error('ERROR: .env file not found. Please copy .env.example to .env and fill in the required values.');
    process.exit(1);
  }

  if (!fs.existsSync(envExampleFile)) {
    console.error('ERROR: .env.example file not found.');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envFile, 'utf8');
  const envExampleContent = fs.readFileSync(envExampleFile, 'utf8');

  const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  const envExampleLines = envExampleContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));

  const missingVars: string[] = [];
  const weakVars: string[] = [];

  for (const exampleLine of envExampleLines) {
    const varName = exampleLine.split('=')[0].trim();
    if (envLines.some(line => line.startsWith(varName + '='))) {
      continue;
    }

    const isRequired = exampleLine.includes('# REQUIRED') || exampleLine.includes('# REQUIRED:') || exampleLine.includes('[REQUIRED]');
    const isSensitive = exampleLine.includes('# SECRET') || exampleLine.includes('# SENSITIVE') || exampleLine.includes('[SECRET]');

    if (isRequired) {
      missingVars.push(varName);
    } else if (isSensitive && exampleLine.includes('SESSION_ENC_KEY')) {
      missingVars.push(varName);
    } else if (!isRequired && isSensitive && exampleLine.includes('JWT_SECRET')) {
      weakVars.push(varName);
    } else if (!isRequired && !isSensitive && exampleLine.includes('API_ID') && !exampleLine.includes('YOUR_API_ID')) {
      weakVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    console.error('\nERROR: Missing required environment variables:');
    missingVars.forEach(varName => console.error(`  - ${varName}`));
    console.error('\nPlease copy .env.example to .env and fill in all required values.\n');
    process.exit(1);
  }

  if (weakVars.length > 0) {
    console.error('\nWARNING: Potentially weak environment variables:');
    weakVars.forEach(varName => console.error(`  - ${varName}`));
    console.error('\nPlease update these with strong values.\n');
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (value && (value.includes('${') || value.includes('__'))) {
      console.error(`\nERROR: Potential template reference found in ${key}: ${value}`);
      process.exit(1);
    }
  }
}