import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { normalizeWidgetTheme, stripCustomCss } from '@sharptalk/types';
import { Tenant } from './entity/tenant.entity';

/**
 * Static live design file (PLN-260910 P4 D-14). Every write to the live widget
 * theme also lands in `UPLOAD_DIR/widget-live/{shop}.json`, which nginx serves
 * straight from the volume at `/widget-design/live/{shop}.json` — so the
 * widget's first paint no longer waits for the API (or for it to be up).
 *
 * The API is the only writer and writes only normalized output: a reader that
 * bypasses the API cannot see anything the API would not have served.
 */
@Injectable()
export class WidgetLiveService {
  private readonly logger = new Logger(WidgetLiveService.name);

  constructor(private readonly config: ConfigService) {}

  /** Shop domains are hostnames; anything else is not a file name we write. */
  static fileKey(shopDomain: string | null | undefined): string | null {
    const key = String(shopDomain ?? '').trim().toLowerCase();
    return /^[a-z0-9][a-z0-9.-]{0,200}$/.test(key) && !key.includes('..') ? key : null;
  }

  private dir(): string {
    return resolve(this.config.get<string>('UPLOAD_DIR', './.uploads'), 'widget-live');
  }

  async publish(tenant: Tenant): Promise<void> {
    const key = WidgetLiveService.fileKey(tenant.shopDomain);
    if (!key) return;
    try {
      await fs.mkdir(this.dir(), { recursive: true });
      const body = JSON.stringify({
        theme: stripCustomCss(normalizeWidgetTheme(tenant.widgetTheme), Number(tenant.customCssEnabled) === 1),
        updatedAt: new Date().toISOString(),
      });
      // Write-then-rename so a reader never sees a half-written file.
      const tmp = join(this.dir(), `${key}.json.tmp`);
      await fs.writeFile(tmp, body);
      await fs.rename(tmp, join(this.dir(), `${key}.json`));
    } catch (e) {
      // The live file is an accelerator, not the source of truth — never let
      // it fail the save that produced it.
      this.logger.warn(`widget live file not written for ${key}: ${(e as Error).message}`);
    }
  }
}
