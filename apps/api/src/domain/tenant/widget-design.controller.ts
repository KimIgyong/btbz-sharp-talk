import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Principal, USER_RANK } from '@sharptalk/types';
import { RequireRank } from '../../global/decorator/auth.decorator';
import { CurrentUser } from '../../global/decorator/current-user.decorator';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';
import { WidgetDesignService } from './widget-design.service';
import { TenantMapper } from './tenant.mapper';
import { WIDGET_DESIGN_STATUS } from './entity/widget-design.entity';
import { CreateWidgetDesignRequest, UpdateWidgetDesignRequest } from './dto/request/tenant.request';

/**
 * Custom widget library (PLN-260910 P3). Own prefix, not /tenants/…: the tenant
 * controller's `:uuid` routes would capture it (RPT-260911 lesson).
 */
@ApiTags('Widget Designs')
@Controller('widget-designs')
@RequireRank(USER_RANK.MASTER, USER_RANK.DIRECTOR)
export class WidgetDesignController {
  constructor(private readonly designs: WidgetDesignService) {}

  private actor(user: Principal): { tenantId: number; userId: number } {
    if (user.actorType !== 'user') throw new BusinessException(ERROR_CODE.FORBIDDEN, HttpStatus.FORBIDDEN);
    return { tenantId: user.tenantId, userId: Number(user.userId) };
  }

  @Get()
  @ApiOperation({ summary: 'List custom widget designs with the live one flagged' })
  async list(@CurrentUser() user: Principal) {
    const { items, activeId } = await this.designs.list(this.actor(user).tenantId);
    return { activeId: activeId != null ? String(activeId) : null, items: items.map((d) => TenantMapper.toWidgetDesign(d, activeId)) };
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom widget design (kept in the library, not live)' })
  async create(@CurrentUser() user: Principal, @Body() body: CreateWidgetDesignRequest) {
    const a = this.actor(user);
    const row = await this.designs.create(a.tenantId, body, a.userId);
    return TenantMapper.toWidgetDesign(row, null);
  }

  /** Package as JSON (D-13): design + embedded font/icon files, importable elsewhere. */
  @Get(':id/export')
  @ApiOperation({ summary: 'Export a design as a JSON package (design + embedded assets)' })
  async exportPackage(@CurrentUser() user: Principal, @Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const a = this.actor(user);
    const pkg = await this.designs.exportPackage(a.tenantId, id);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(String(pkg.name))}.sharptalk-widget.json`,
    );
    res.send(JSON.stringify(pkg));
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Import a JSON package as a new library design (assets re-validated)' })
  async importPackage(@CurrentUser() user: Principal, @UploadedFile() file?: { buffer: Buffer }) {
    const a = this.actor(user);
    if (!file?.buffer) throw new BusinessException(ERROR_CODE.VALIDATION_FAILED, HttpStatus.BAD_REQUEST);
    return TenantMapper.toWidgetDesign(await this.designs.importPackage(a.tenantId, file.buffer, a.userId), null);
  }

  @Post('revert')
  @ApiOperation({ summary: 'Back to the basic widget (no custom design live)' })
  async revert(@CurrentUser() user: Principal) {
    const a = this.actor(user);
    await this.designs.revert(a.tenantId, a.userId);
    return { activeId: null };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a design (a live design changes the storefront immediately)' })
  async update(@CurrentUser() user: Principal, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateWidgetDesignRequest) {
    const a = this.actor(user);
    const row = await this.designs.update(a.tenantId, id, body, a.userId);
    const { activeId } = await this.designs.list(a.tenantId);
    return TenantMapper.toWidgetDesign(row, activeId);
  }

  @Post(':id/apply')
  @ApiOperation({ summary: 'Use this design as the live widget' })
  async apply(@CurrentUser() user: Principal, @Param('id', ParseIntPipe) id: number) {
    const a = this.actor(user);
    const row = await this.designs.apply(a.tenantId, id, a.userId);
    return TenantMapper.toWidgetDesign(row, Number(row.id));
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Copy a design as a new library entry' })
  async duplicate(@CurrentUser() user: Principal, @Param('id', ParseIntPipe) id: number) {
    const a = this.actor(user);
    return TenantMapper.toWidgetDesign(await this.designs.duplicate(a.tenantId, id, a.userId), null);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Move a design to the archive (refused while live)' })
  async archive(@CurrentUser() user: Principal, @Param('id', ParseIntPipe) id: number) {
    const a = this.actor(user);
    return TenantMapper.toWidgetDesign(await this.designs.setStatus(a.tenantId, id, WIDGET_DESIGN_STATUS.ARCHIVED, a.userId), null);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Bring an archived design back to the library' })
  async restore(@CurrentUser() user: Principal, @Param('id', ParseIntPipe) id: number) {
    const a = this.actor(user);
    return TenantMapper.toWidgetDesign(await this.designs.setStatus(a.tenantId, id, WIDGET_DESIGN_STATUS.READY, a.userId), null);
  }

  @Get(':id/revisions')
  @ApiOperation({ summary: 'Change history of a design (newest first, before-edit snapshots)' })
  async revisions(@CurrentUser() user: Principal, @Param('id', ParseIntPipe) id: number) {
    const rows = await this.designs.revisions(this.actor(user).tenantId, id);
    return rows.map((r) => ({
      id: String(r.id),
      revisionNo: r.revisionNo,
      name: r.name,
      note: r.note,
      design: r.designJson,
      actorUserId: r.actorUserId != null ? String(r.actorUserId) : null,
      createdAt: r.createdAt,
    }));
  }

  @Post(':id/revisions/:revisionId/restore')
  @ApiOperation({ summary: 'Restore a snapshot over the design (live copy re-synced when in use)' })
  async restoreRevision(
    @CurrentUser() user: Principal,
    @Param('id', ParseIntPipe) id: number,
    @Param('revisionId', ParseIntPipe) revisionId: number,
  ) {
    const a = this.actor(user);
    const row = await this.designs.restoreRevision(a.tenantId, id, revisionId, a.userId);
    const { activeId } = await this.designs.list(a.tenantId);
    return TenantMapper.toWidgetDesign(row, activeId);
  }

  @Post(':id/preview-token')
  @ApiOperation({ summary: 'Short-lived token the console preview iframe passes as ?preview=' })
  async previewToken(@CurrentUser() user: Principal, @Param('id', ParseIntPipe) id: number) {
    return this.designs.previewToken(this.actor(user).tenantId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a design (refused while live)' })
  async remove(@CurrentUser() user: Principal, @Param('id', ParseIntPipe) id: number) {
    const a = this.actor(user);
    await this.designs.remove(a.tenantId, id, a.userId);
    return { deleted: true };
  }
}
