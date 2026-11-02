import { unlinkSync } from 'node:fs';
import path from 'node:path';
import { config } from '../src/config/index.js';
import { decryptSession, getSessionFilePath } from '../src/utils/session.js';

async function main() {
  console.log('\n=== Telegram Monitor Logout ===\n');

  try {
    const sessionFilePath = getSessionFilePath();

    if (!sessionFilePath) {
      console.log('No session file found or session not configured.');
      console.log('You may already be logged out.');
    } else {
      console.log(`Found session file: ${sessionFilePath}`);

      const exists = await import('fs').then(fs => fs.promises.access(sessionFilePath).then(() => true).catch(() => false));

      if (exists) {
        const encryptedSession = await decryptSession();

        const { default: TelegramClient } = await import('telegram');
        const client = new TelegramClient(
          {
            apiId: config.telegram.apiId,
            apiHash: config.telegram.apiHash,
            phoneNumber: config.telegram.phoneNumber,
          },
          { connection: { maxRetries: 3 } }
        );

        await client.connect();
        await client.invoke(new client.sessions.SaveSession(encryptedSession));

        console.log('Session invalidated on Telegram servers');

        await unlinkSync(sessionFilePath);
        console.log('Session file deleted');
      } else {
        console.log('Session file does not exist');
      }
    }

    console.log('\n=== Logout Complete ===');
  } catch (error) {
    console.error('\nLogout failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };