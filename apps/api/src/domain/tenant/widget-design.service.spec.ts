import { WidgetDesignService } from './widget-design.service';
import { Tenant } from './entity/tenant.entity';
import { WidgetDesignRow } from './entity/widget-design.entity';

/**
 * Custom widget library (PLN-260910 P3 D-12′): the live pointer + live copy,
 * the guards around the live design, and the preview token round trip.
 */
describe('WidgetDesignService', () => {
  beforeAll(() => {
    process.env.CRED_ENC_KEY = Buffer.alloc(32, 9).toString('base64');
  });

  const design = { font: { preset: 'inter', baseSize: 15 }, radius: 'lg', panel: { width: 420, height: 700 } };

  function build() {
    const rows: WidgetDesignRow[] = [];
    const tenant = {
      id: 1,
      widgetTheme: { brand: '#2B7FFF', headerStyle: 'white', launcher: { position: 'right', size: 'md', icon: 'chat' } },
      activeWidgetDesignId: null,
    } as unknown as Tenant;
    let nextId = 10;
    const repo = {
      create: (d: Partial<WidgetDesignRow>) => d as WidgetDesignRow,
      save: jest.fn(async (d: WidgetDesignRow) => {
        if (d.id == null) d.id = nextId++;
        const i = rows.findIndex((r) => r.id === d.id);
        if (i >= 0) rows[i] = d;
        else rows.push(d);
        return d;
      }),
      find: jest.fn(async () => rows),
      findOne: jest.fn(async ({ where }: any) =>
        rows.find((r) => (where.id == null || r.id === where.id) && (where.name == null || r.name === where.name)) ?? null),
      delete: jest.fn(async ({ id }: any) => {
        const i = rows.findIndex((r) => r.id === id);
        if (i >= 0) rows.splice(i, 1);
      }),
    };
    const tenantRepo = { save: jest.fn(async (t: Tenant) => t), findOne: jest.fn(async () => tenant) };
    const tenants = {
      findById: jest.fn(async () => tenant),
      resolveDesign: jest.fn(async (_t: number, d: any) => ({
        font: d.font ? { preset: d.font.preset, asset: null, baseSize: d.font.base_size } : null,
        radius: d.radius ?? null,
        panel: d.panel ?? null,
        launcherIcon: null,
      })),
    };
    const audit = { write: jest.fn() };
    const svc = new WidgetDesignService(repo as never, tenantRepo as never, tenants as never, audit as never);
    return { svc, rows, tenant, audit };
  }

  const wire = { font: { preset: 'inter', base_size: 15 }, radius: 'lg', panel: { width: 420, height: 700 } };

  it('create keeps the design in the library without touching the live theme; apply copies it live', async () => {
    const h = build();
    const row = await h.svc.create(1, { name: '봄', design: wire } as never, 7);
    expect(row.designJson).toEqual(design);
    expect(h.tenant.activeWidgetDesignId).toBeNull();
    expect(h.tenant.widgetTheme?.design).toBeUndefined();

    await h.svc.apply(1, Number(row.id), 7);
    expect(h.tenant.activeWidgetDesignId).toBe(Number(row.id));
    expect(h.tenant.widgetTheme?.design).toEqual(design);
    expect(h.tenant.widgetTheme?.brand).toBe('#2B7FFF');
    expect(h.audit.write).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'tenant.widget_design_applied' }));
  });

  it('refuses to archive or delete the live design, and revert clears pointer + live copy', async () => {
    const h = build();
    const row = await h.svc.create(1, { name: 'A', design: wire } as never, 7);
    await h.svc.apply(1, Number(row.id), 7);
    await expect(h.svc.setStatus(1, Number(row.id), 'archived', 7)).rejects.toMatchObject({ errorCode: 'E5086' });
    await expect(h.svc.remove(1, Number(row.id), 7)).rejects.toMatchObject({ errorCode: 'E5086' });

    await h.svc.revert(1, 7);
    expect(h.tenant.activeWidgetDesignId).toBeNull();
    expect(h.tenant.widgetTheme?.design).toBeUndefined();
    expect(h.tenant.widgetTheme?.launcher?.icon).toBe('chat');
    await h.svc.remove(1, Number(row.id), 7);
    expect(h.rows).toHaveLength(0);
  });

  it('rejects a duplicate name, and duplicate() picks a free copy name', async () => {
    const h = build();
    await h.svc.create(1, { name: 'A', design: wire } as never, 7);
    await expect(h.svc.create(1, { name: 'A', design: wire } as never, 7)).rejects.toMatchObject({ errorCode: 'E5087' });
    const copy = await h.svc.duplicate(1, 10, 7);
    expect(copy.name).toBe('A (copy)');
    const copy2 = await h.svc.duplicate(1, 10, 7);
    expect(copy2.name).toBe('A (copy 2)');
  });

  it('editing the live design updates the live copy; preview token resolves to basic ⊕ design', async () => {
    const h = build();
    const row = await h.svc.create(1, { name: 'A', design: wire } as never, 7);
    await h.svc.apply(1, Number(row.id), 7);
    await h.svc.update(1, Number(row.id), { design: { ...wire, radius: 'sm' } } as never, 7);
    expect(h.tenant.widgetTheme?.design?.radius).toBe('sm');

    const { token } = await h.svc.previewToken(1, Number(row.id));
    const theme = await h.svc.previewTheme(token);
    expect(theme?.brand).toBe('#2B7FFF');
    expect(theme?.design?.radius).toBe('sm');
    expect(await h.svc.previewTheme(token.replace(/[0-9a-f]{4}$/, '0000'))).toBeNull();
  });
});
