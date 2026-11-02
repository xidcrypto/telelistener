import { ensureDir } from 'fs-extra';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export class MediaProcessor {
  private mediaDir: string;
  private mimeWhitelist: string[];
  private maxFileSize: number;

  constructor(mediaDir: string, mimeWhitelist: string[], maxFileSize: number) {
    this.mediaDir = mediaDir;
    this.mimeWhitelist = mimeWhitelist;
    this.maxFileSize = maxFileSize;

    this.initializeMediaDir();
  }

  private async initializeMediaDir(): Promise<void> {
    await ensureDir(this.mediaDir);
    logger.info({ path: this.mediaDir }, 'Media directory initialized');
  }

  async processMedia(telegramMessage: any, messageId: number, client: any, channelId: number): Promise<any> {
    const media = telegramMessage.media[0];
    const mimeType = media.mimeType || 'application/octet-stream';

    if (!this.mimeWhitelist.includes(mimeType)) {
      logger.warn({ mimeType, messageId }, 'Media type not in whitelist, skipping');
      return null;
    }

    const fileSize = media.size || 0;
    if (fileSize > this.maxFileSize) {
      logger.warn({ fileSize, maxFileSize: this.maxFileSize, messageId }, 'Media file size exceeds limit, skipping');
      return null;
    }

    try {
      const fileName = `${uuidv4()}-${Date.now()}`;
      const storedPath = join(this.mediaDir, fileName);

      await this.downloadMedia(media, storedPath, client);

      const mediaInfo = {
        fileName,
        storedPath,
        fileSize,
        mimeType,
        telegramFileId: media.id,
        messageId,
        channelId,
      };

      logger.info({ mediaInfo }, 'Media processed successfully');

      return mediaInfo;
    } catch (error) {
      logger.error({ error, messageId }, 'Failed to process media');
      throw error;
    }
  }

  private async downloadMedia(media: any, destination: string, client: any): Promise<void> {
    const fileId = media.id;
    const file = await client.downloadMedia(fileId, { directory: this.mediaDir });

    if (!file) {
      throw new Error('Failed to download media');
    }

    const fs = await import('fs').then(m => m.promises);
    await fs.writeFile(destination, file);
  }

  async getMediaInfo(id: number): Promise<any> {
    const mediaDir = this.mediaDir;
    const fs = await import('fs').then(m => m.promises);

    const files = await fs.readdir(mediaDir);
    const matchingFile = files.find(file => file.startsWith(`${id}-`));

    if (!matchingFile) {
      return null;
    }

    const filePath = join(mediaDir, matchingFile);
    const stats = await fs.stat(filePath);

    return {
      id,
      fileName: matchingFile,
      storedPath: filePath,
      fileSize: stats.size,
      mimeType: this.getMimeType(matchingFile),
    };
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();

    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      pdf: 'application/pdf',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      mpeg: 'video/mpeg',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      webm: 'video/webm',
    };

    return mimeMap[ext || ''] || 'application/octet-stream';
  }
}