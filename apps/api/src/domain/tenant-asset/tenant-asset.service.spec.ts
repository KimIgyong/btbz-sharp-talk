import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { TenantAssetService } from './tenant-asset.service';
import { TenantAsset } from './entity/tenant-asset.entity';

/**
 * Tenant asset store (PLN-260910 P1). Validation is by content; the tests
 * hand over bytes, never trust the filename, and check the tenant-root path.
 */
describe('TenantAssetService', () => {
  // Signed URLs derive their key from the credential key; the unit has no env file.
  beforeAll(() => {
    process.env.CRED_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  const rows: TenantAsset[] = [];
  let root: string;
  let svc: TenantAssetService;
  let audit: { write: jest.Mock };

  beforeEach(async () => {
    rows.length = 0;
    root = await fs.mkdtemp(join(tmpdir(), 'tenant-assets-'));
    const repo = {
      create: (d: Partial<TenantAsset>) => d as TenantAsset,
      save: jest.fn(async (d: TenantAsset) => {
        const row = { id: rows.length + 1, ...d } as TenantAsset;
        const i = rows.findIndex((r) => r.uuid === row.uuid);
        if (i >= 0) rows[i] = row;
        else rows.push(row);
        return row;
      }),
      find: jest.fn(async () => rows.filter((r) => !r.deletedAt)),
      findOne: jest.fn(async ({ where }: any) => rows.find((r) => r.uuid === where.uuid && !r.deletedAt) ?? null),
      createQueryBuilder: () => ({
        select() { return this; },
        where() { return this; },
        getRawOne: async () => ({ used: String(rows.filter((r) => !r.deletedAt).reduce((s, r) => s + r.size, 0)) }),
      }),
    };
    const config = { get: (k: string, d?: string) => (k === 'UPLOAD_DIR' ? root : d) };
    audit = { write: jest.fn() };
    svc = new TenantAssetService(repo as never, config as never, audit as never);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const woff2 = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(64)]);
  const actor = { userId: 7 };

  it('stores a woff2 font under tenants/{id}/design and audits', async () => {
    const row = await svc.store(1, { area: 'design', kind: 'font' }, { originalname: 'Brand.woff2', mimetype: 'x', size: 68, buffer: woff2 }, actor);
    expect(row.storagePath).toBe(join('tenants', '1', 'design', `${row.uuid}.woff2`));
    expect(row.mime).toBe('font/woff2');
    await expect(fs.stat(join(root, row.storagePath))).resolves.toBeTruthy();
    expect(TenantAssetService.urlFor(row)).toBe(`/api/v1/public/widget/asset/${row.uuid}?v=1`);
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'tenant.asset_uploaded' }));
  });

  it('judges by content, not by name: an svg named .woff2 is refused', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    await expect(
      svc.store(1, { area: 'design', kind: 'font' }, { originalname: 'evil.woff2', mimetype: 'font/woff2', size: 1, buffer: svg }, actor),
    ).rejects.toMatchObject({ errorCode: 'E5081' });
  });

  it('refuses an unknown kind/area and an oversized file', async () => {
    await expect(
      svc.store(1, { area: 'settings', kind: 'font' }, { originalname: 'a', mimetype: 'x', size: 1, buffer: woff2 }, actor),
    ).rejects.toMatchObject({ errorCode: 'E5085' });
    const big = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(2 * 1024 * 1024 + 1)]);
    await expect(
      svc.store(1, { area: 'design', kind: 'font' }, { originalname: 'a', mimetype: 'x', size: 1, buffer: big }, actor),
    ).rejects.toMatchObject({ errorCode: 'E5082' });
  });

  it('enforces the area quota against what is already stored', async () => {
    process.env.TENANT_ASSET_QUOTA_DESIGN_MB = '0.0001'; // ~105 bytes
    const cfg = { get: (k: string, d?: string) => (k === 'UPLOAD_DIR' ? root : process.env[k] ?? d) };
    const s2 = new TenantAssetService((svc as any).repo, cfg as never, audit as never);
    await s2.store(1, { area: 'design', kind: 'font' }, { originalname: 'a', mimetype: 'x', size: 1, buffer: woff2 }, actor);
    await expect(
      s2.store(1, { area: 'design', kind: 'font' }, { originalname: 'b', mimetype: 'x', size: 1, buffer: woff2 }, actor),
    ).rejects.toMatchObject({ errorCode: 'E5084' });
    delete process.env.TENANT_ASSET_QUOTA_DESIGN_MB;
  });

  it('remove soft-deletes the row and unlinks the file; a doc is served only via signed URL', async () => {
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(16)]);
    const row = await svc.store(1, { area: 'design', kind: 'doc' }, { originalname: 'guide.pdf', mimetype: 'x', size: 1, buffer: pdf }, actor);
    expect(TenantAssetService.urlFor(row)).toMatch(/\/tenant-assets\/.+\/file\?exp=\d+&sig=[0-9a-f]+$/);
    await expect(svc.openPublic(row.uuid)).rejects.toMatchObject({ errorCode: 'E5002' });
    await svc.remove(1, row.uuid, actor);
    expect(rows[0].deletedAt).toBeTruthy();
    await expect(fs.stat(join(root, row.storagePath))).rejects.toBeTruthy();
    expect(audit.write).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'tenant.asset_deleted' }));
  });
});
