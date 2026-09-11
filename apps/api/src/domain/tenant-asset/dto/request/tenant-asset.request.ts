import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TENANT_ASSET_AREA, TENANT_ASSET_KIND } from '../../entity/tenant-asset.entity';

/** Multipart fields beside the file (PLN-260910 P1). */
export class UploadTenantAssetRequest {
  @IsIn([TENANT_ASSET_AREA.DESIGN]) area: string;
  @IsIn([TENANT_ASSET_KIND.FONT, TENANT_ASSET_KIND.ICON, TENANT_ASSET_KIND.IMAGE, TENANT_ASSET_KIND.DOC])
  kind: string;
  @IsOptional() @IsString() @MaxLength(128) label?: string;
}

export class ListTenantAssetsQuery {
  @IsOptional() @IsString() area?: string;
  @IsOptional() @IsString() kind?: string;
}
