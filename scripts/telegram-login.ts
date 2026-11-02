import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { config } from '../src/config/index.js';
import { createSessionFile, encryptSession } from '../src/utils/session.js';

const rl = readline.createInterface({ input, output });

async function prompt(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('\n=== Telegram Monitor Login ===\n');

  let phoneNumber = config.telegram.phoneNumber;
  if (!phoneNumber) {
    phoneNumber = await prompt('Enter your phone number (+ country code): ');
    if (!phoneNumber.startsWith('+')) {
      console.error('Error: Phone number must start with +');
      process.exit(1);
    }
  } else {
    console.log(`Using phone number from config: ${phoneNumber}`);
  }

  let password = '';
  if (config.production) {
    password = await prompt('Enter your 2FA password (if any): ');
  }

  try {
    console.log('\nStarting Telegram authentication...');

    const { default: TelegramClient } = await import('telegram');
    const client = new TelegramClient(
      {
        apiId: config.telegram.apiId,
        apiHash: config.telegram.apiHash,
        phoneNumber: phoneNumber,
        password: password || undefined,
      },
      {
        connection: { maxRetries: 3, retryDelay: 1000 },
        limit: { fileSize: config.telegram.maxMediaSizeBytes / (1024 * 1024) },
      }
    );

    await client.connect();

    const session = client.session.serialize();

    const sessionFilePath = await createSessionFile(session);

    console.log('\n=== Login Successful ===');
    console.log(`Session saved to: ${sessionFilePath}`);
    console.log('\nYou can now start the application:');
    console.log('  npm run login      # Interactive login (or use stored session)');
    console.log('  npm logout         # Clear session');
    console.log('  npm start         # Start the monitor');
    console.log('');
  } catch (error) {
    console.error('\nLogin failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
}

export { main };