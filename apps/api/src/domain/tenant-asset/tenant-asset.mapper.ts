import { TenantAsset } from './entity/tenant-asset.entity';
import { TenantAssetService } from './tenant-asset.service';

export class TenantAssetMapper {
  static toAsset(a: TenantAsset, now: number = Date.now()) {
    return {
      id: String(a.id),
      uuid: a.uuid,
      area: a.area,
      kind: a.kind,
      filename: a.filename,
      label: a.label ?? null,
      mime: a.mime,
      ext: a.ext,
      size: a.size,
      width: a.width ?? null,
      height: a.height ?? null,
      version: a.version,
      public: TenantAssetService.isPublic(a.kind),
      url: TenantAssetService.urlFor(a, now),
      createdAt: a.createdAt,
    };
  }
}
