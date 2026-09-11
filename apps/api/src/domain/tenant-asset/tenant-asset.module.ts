import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantAsset } from './entity/tenant-asset.entity';
import { TenantAssetService } from './tenant-asset.service';
import { PublicWidgetAssetController, TenantAssetController } from './tenant-asset.controller';
import { AuditModule } from '../audit/audit.module';

/** Tenant asset store (PLN-260910 P1) — files under tenants/{id}/{area}. */
@Module({
  imports: [TypeOrmModule.forFeature([TenantAsset]), AuditModule],
  controllers: [TenantAssetController, PublicWidgetAssetController],
  providers: [TenantAssetService],
  exports: [TenantAssetService],
})
export class TenantAssetModule {}
