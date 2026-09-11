import { Body, Controller, Delete, Get, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Principal, USER_RANK } from '@sharptalk/types';
import { RequireRank } from '../../global/decorator/auth.decorator';
import { CurrentUser } from '../../global/decorator/current-user.decorator';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';
import { SettingsSnapshotService } from './settings-snapshot.service';
import { TenantAssetMapper } from '../tenant-asset/tenant-asset.mapper';

class CreateSnapshotRequest {
  @IsOptional() @IsString() @MaxLength(128) label?: string;
}

/** Settings snapshots (PLN-260910 P4 D-8). Own prefix — see the /tenants/:uuid capture lesson. */
@ApiTags('Settings Snapshots')
@Controller('settings-snapshots')
@RequireRank(USER_RANK.MASTER, USER_RANK.DIRECTOR)
export class SettingsSnapshotController {
  constructor(private readonly snapshots: SettingsSnapshotService) {}

  private actor(user: Principal): { tenantId: number; userId: number } {
    if (user.actorType !== 'user') throw new BusinessException(ERROR_CODE.FORBIDDEN, HttpStatus.FORBIDDEN);
    return { tenantId: user.tenantId, userId: Number(user.userId) };
  }

  @Get()
  @ApiOperation({ summary: 'List settings snapshots (files in tenants/{id}/settings)' })
  async list(@CurrentUser() user: Principal) {
    const rows = await this.snapshots.list(this.actor(user).tenantId);
    const now = Date.now();
    return rows.map((r) => TenantAssetMapper.toAsset(r, now));
  }

  @Post()
  @ApiOperation({ summary: 'Take a snapshot of the whitelisted settings + custom widget library' })
  async create(@CurrentUser() user: Principal, @Body() body: CreateSnapshotRequest) {
    const a = this.actor(user);
    return TenantAssetMapper.toAsset(await this.snapshots.create(a.tenantId, body.label, a.userId));
  }

  @Get(':uuid/diff')
  @ApiOperation({ summary: 'Compare a snapshot with the current settings' })
  async diff(@CurrentUser() user: Principal, @Param('uuid') uuid: string) {
    return this.snapshots.diff(this.actor(user).tenantId, uuid);
  }

  @Post(':uuid/restore')
  @ApiOperation({ summary: 'Restore the snapshot (settings + design library); audited' })
  async restore(@CurrentUser() user: Principal, @Param('uuid') uuid: string) {
    const a = this.actor(user);
    await this.snapshots.restore(a.tenantId, uuid, a.userId);
    return { restored: true };
  }

  @Delete(':uuid')
  @ApiOperation({ summary: 'Delete a snapshot file' })
  async remove(@CurrentUser() user: Principal, @Param('uuid') uuid: string) {
    const a = this.actor(user);
    await this.snapshots.remove(a.tenantId, uuid, a.userId);
    return { deleted: true };
  }
}
