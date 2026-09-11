import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Principal, USER_RANK } from '@sharptalk/types';
import { RequireRank } from '../../global/decorator/auth.decorator';
import { Public } from '../../global/decorator/public.decorator';
import { CurrentUser } from '../../global/decorator/current-user.decorator';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';
import { decodeUploadName } from '../../global/util/upload-name.util';
import { AssetUpload, TenantAssetService } from './tenant-asset.service';
import { TenantAssetMapper } from './tenant-asset.mapper';
import { ListTenantAssetsQuery, UploadTenantAssetRequest } from './dto/request/tenant-asset.request';
import { TENANT_ASSET_AREA } from './entity/tenant-asset.entity';

/**
 * Tenant asset store — console side (PLN-260910 P1). Same rank gate as the
 * widget theme: what the storefront widget looks like is a master/director call.
 */
@ApiTags('Tenant Assets')
// Not under /tenants/…: the tenant controller's `:uuid` routes would capture
// "assets" as a tenant id (AdminOnly → E1004) before Nest reaches this one.
@Controller('tenant-assets')
export class TenantAssetController {
  constructor(private readonly assets: TenantAssetService) {}

  private tenantUser(user: Principal): { tenantId: number; userId: number } {
    if (user.actorType !== 'user') {
      throw new BusinessException(ERROR_CODE.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    return { tenantId: user.tenantId, userId: Number(user.userId) };
  }

  @Get()
  @RequireRank(USER_RANK.MASTER, USER_RANK.DIRECTOR)
  @ApiOperation({ summary: 'List this tenant’s assets (area/kind filter) with quota usage' })
  async list(@CurrentUser() user: Principal, @Query() query: ListTenantAssetsQuery) {
    const { tenantId } = this.tenantUser(user);
    const area = query.area || TENANT_ASSET_AREA.DESIGN;
    const [items, usage] = await Promise.all([
      this.assets.list(tenantId, { area, kind: query.kind }),
      this.assets.usage(tenantId, area),
    ]);
    const now = Date.now();
    return { items: items.map((a) => TenantAssetMapper.toAsset(a, now)), usage: { area, ...usage } };
  }

  @Post()
  @RequireRank(USER_RANK.MASTER, USER_RANK.DIRECTOR)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload one asset (multipart: file + area + kind [+ label])' })
  async upload(
    @CurrentUser() user: Principal,
    @Body() body: UploadTenantAssetRequest,
    @UploadedFile() file?: AssetUpload,
  ) {
    const a = this.tenantUser(user);
    if (!file) throw new BusinessException(ERROR_CODE.VALIDATION_FAILED, HttpStatus.BAD_REQUEST);
    const row = await this.assets.store(
      a.tenantId,
      body,
      { ...file, originalname: decodeUploadName(file.originalname) },
      { userId: a.userId },
    );
    return TenantAssetMapper.toAsset(row);
  }

  @Delete(':uuid')
  @RequireRank(USER_RANK.MASTER, USER_RANK.DIRECTOR)
  @ApiOperation({ summary: 'Delete an asset (soft row, file unlinked)' })
  async remove(@CurrentUser() user: Principal, @Param('uuid') uuid: string) {
    const a = this.tenantUser(user);
    await this.assets.remove(a.tenantId, uuid, { userId: a.userId });
    return { deleted: true };
  }

  /** Private kinds (doc): signed URL, like board/chat attachments. */
  @Get(':uuid/file')
  @Public()
  @ApiOperation({ summary: 'Stream a private asset by signed URL (exp + sig required)' })
  async file(
    @Param('uuid') uuid: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    const { stream, row } = await this.assets.openSigned(uuid, Number(exp), sig);
    res.setHeader('Content-Type', row.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`);
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }
}

/**
 * Public asset route for the widget (D-4): fonts/icons/images by uuid, cached
 * hard only when the URL carries the version being served — the logo rule.
 */
@ApiTags('Widget')
@Controller('public/widget')
export class PublicWidgetAssetController {
  constructor(private readonly assets: TenantAssetService) {}

  @Get('asset/:uuid')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'A public design asset (font/icon/image), cached' })
  async asset(@Param('uuid') uuid: string, @Query('v') version: string, @Res() res: Response) {
    const { stream, row } = await this.assets.openPublic(uuid);
    res.setHeader('Content-Type', row.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Cache-Control',
      version === String(row.version) ? 'public, max-age=31536000, immutable' : 'public, max-age=60',
    );
    // Fonts are fetched cross-origin by the widget iframe when the API is on
    // another host (split deployment); browsers refuse them without CORS.
    if (row.kind === 'font') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
    stream.on('error', () => {
      if (!res.headersSent) res.status(HttpStatus.NOT_FOUND);
      res.end();
    });
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }
}
