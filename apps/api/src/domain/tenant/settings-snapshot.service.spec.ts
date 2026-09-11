import { SettingsSnapshotService, SNAPSHOT_FORMAT } from './settings-snapshot.service';
import { Tenant } from './entity/tenant.entity';

describe('SettingsSnapshotService (PLN-260910 P4 D-8)', () => {
  function build() {
    const tenant = {
      id: 1, slug: 'ivyusa', widgetTheme: { brand: '#2B7FFF', headerStyle: 'white' }, widgetCopy: null, widgetTabs: ['chat'],
      widgetTabPosition: 'top', widgetLoginMode: 'redirect', notificationChannels: null, embedOrigins: null, usageGuidesEnabled: 1,
      timezone: 'Asia/Seoul', storefrontUrl: 'https://ivyusa.com', privacyPolicyUrl: null, consentNoticeVersion: null,
      activeWidgetDesignId: null, embedSecret: 'SECRET', shopifyAccessToken: 'TOKEN',
    } as unknown as Tenant;
    const designs: any[] = [];
    const designRepo = {
      find: jest.fn(async () => designs),
      findOne: jest.fn(async ({ where }: any) => designs.find((d) => d.name === where.name) ?? null),
      create: (d: any) => d,
      save: jest.fn(async (d: any) => { if (d.id == null) { d.id = designs.length + 1; designs.push(d); } return d; }),
    };
    const stored: Array<{ buffer: Buffer; input: any }> = [];
    const assets = {
      storeGenerated: jest.fn(async (_t: number, input: any, buffer: Buffer) => { stored.push({ buffer, input }); return { uuid: 'snap-1', kind: 'settings_snapshot', ...input }; }),
      get: jest.fn(async () => ({ uuid: 'snap-1', kind: 'settings_snapshot' })),
      readBuffer: jest.fn(async () => stored[0].buffer),
      list: jest.fn(async () => []),
      remove: jest.fn(),
    };
    const tenantRepo = { save: jest.fn(async (t: Tenant) => t) };
    const live = { publish: jest.fn() };
    const audit = { write: jest.fn() };
    const svc = new SettingsSnapshotService(tenantRepo as never, designRepo as never, { findById: async () => tenant } as never, assets as never, live as never, audit as never);
    return { svc, tenant, designs, stored, assets, live, audit };
  }

  it('snapshot carries only whitelisted fields (no secrets) plus the design library', async () => {
    const h = build();
    h.designs.push({ id: 5, name: '봄', designJson: { radius: 'lg' }, status: 'ready', note: null });
    h.tenant.activeWidgetDesignId = 5;
    await h.svc.create(1, '배포 전', 7);
    const body = JSON.parse(h.stored[0].buffer.toString('utf8'));
    expect(body.format).toBe(SNAPSHOT_FORMAT);
    expect(JSON.stringify(body)).not.toMatch(/SECRET|TOKEN/);
    expect(body.settings.timezone).toBe('Asia/Seoul');
    expect(body.settings.embedSecret).toBeUndefined();
    expect(body.widgetDesigns).toEqual([{ name: '봄', note: null, status: 'ready', design: { radius: 'lg' }, active: true }]);
    expect(h.stored[0].input).toMatchObject({ area: 'settings', kind: 'settings_snapshot', label: '배포 전', ext: 'json' });
  });

  it('diff flags changed fields; restore writes them back, upserts designs by name, re-activates, publishes, audits', async () => {
    const h = build();
    h.designs.push({ id: 5, name: '봄', designJson: { radius: 'lg' }, status: 'ready', note: null });
    h.tenant.activeWidgetDesignId = 5;
    await h.svc.create(1, undefined, 7);
    // Drift after the snapshot.
    (h.tenant as any).timezone = 'America/New_York';
    h.tenant.activeWidgetDesignId = null;
    h.designs.length = 0;

    const diff = await h.svc.diff(1, 'snap-1');
    expect(diff.fields.find((f) => f.field === 'timezone')).toMatchObject({ current: 'America/New_York', snapshot: 'Asia/Seoul', changed: true });
    expect(diff.fields.find((f) => f.field === 'widgetLoginMode')?.changed).toBe(false);
    expect(diff.designs).toEqual([{ name: '봄', action: 'create', active: true }]);

    await h.svc.restore(1, 'snap-1', 7);
    expect((h.tenant as any).timezone).toBe('Asia/Seoul');
    expect(h.designs).toHaveLength(1);
    expect(h.tenant.activeWidgetDesignId).toBe(1);
    expect(h.live.publish).toHaveBeenCalled();
    expect(h.audit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'tenant.settings_restored' }));
  });
});
