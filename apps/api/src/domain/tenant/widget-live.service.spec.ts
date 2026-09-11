import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { WidgetLiveService } from './widget-live.service';
import { Tenant } from './entity/tenant.entity';

describe('WidgetLiveService (PLN-260910 P4 D-14)', () => {
  let root: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(join(tmpdir(), 'widget-live-'));
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('keys the file by a sanitized shop domain and writes the normalized theme', async () => {
    const svc = new WidgetLiveService({ get: (k: string, d?: string) => (k === 'UPLOAD_DIR' ? root : d) } as never);
    await svc.publish({ shopDomain: 'Ambshop-Dev.myshopify.com', widgetTheme: { brand: '#2b7fff', headerStyle: 'brand', design: { radius: 'xl', panel: { width: 9999 } } } } as unknown as Tenant);
    const body = JSON.parse(await fs.readFile(join(root, 'widget-live', 'ambshop-dev.myshopify.com.json'), 'utf8'));
    expect(body.theme.brand).toBe('#2B7FFF');
    expect(body.theme.design).toEqual({ panel: { width: 480, height: 600 } });
    expect(body.updatedAt).toBeTruthy();
  });

  it('refuses a key that is not a hostname (path traversal) and never throws', async () => {
    expect(WidgetLiveService.fileKey('../etc/passwd')).toBeNull();
    expect(WidgetLiveService.fileKey('a/b')).toBeNull();
    expect(WidgetLiveService.fileKey(null)).toBeNull();
    const svc = new WidgetLiveService({ get: () => '/nonexistent/\0' } as never);
    await expect(svc.publish({ shopDomain: 'x.com', widgetTheme: null } as never)).resolves.toBeUndefined();
  });
});
