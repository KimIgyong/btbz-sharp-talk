import { Controller, Get, HttpStatus, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { TenantService } from './tenant.service';
import { WidgetLogoService } from './widget-logo.service';
import { WidgetDesignService } from './widget-design.service';
import { Public } from '../../global/decorator/public.decorator';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';

/**
 * Public brand assets for the widget (PLN-260819 S4 FR-T1).
 *
 * Separate from the tenant console controller because everything here is
 * unauthenticated and cached hard, while everything there is neither.
 */
@ApiTags('Widget')
@Controller('public/widget')
export class WidgetBrandingController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly widgetLogo: WidgetLogoService,
    private readonly designs: WidgetDesignService,
  ) {}

  /**
   * No auth and no signature, deliberately: the widget paints this before anyone
   * is identified, and a signed URL would defeat the cache and expire mid-visit.
   * A logo is not private data. `v` is only a cache buster — a new upload gets a
   * new id, so the URL changes whenever the file does.
   */
  /**
   * Preview theme for a signed, short-lived token (PLN-260910 P3 D-15): lets
   * the console show an unapplied design in the real widget without touching
   * what shoppers see. No tenant data beyond the theme leaves here.
   */
  @Get('preview-theme')
  @Public()
  @ApiOperation({ summary: 'Theme for a console preview token (signed, 10 min)' })
  async previewTheme(@Query('token') token: string) {
    const theme = await this.designs.previewTheme(token ?? '');
    if (!theme) throw new BusinessException(ERROR_CODE.FORBIDDEN, HttpStatus.FORBIDDEN);
    return { theme };
  }

  @Get('logo')
  @Public()
  @SkipThrottle() // one request per storefront page load, same as the widget itself
  @ApiOperation({ summary: "A storefront's widget logo (public, cached)" })
  async logo(
    @Query('shop') shop: string,
    @Query('v') version: string,
    @Res() res: Response,
  ): Promise<void> {
    const tenant = shop ? await this.tenantService.findByShopDomain(shop) : null;
    const logo = tenant?.widgetTheme?.logo ?? null;
    if (!tenant || !logo) {
      res.status(HttpStatus.NOT_FOUND).end();
      return;
    }

    res.setHeader('Content-Type', logo.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // `immutable` is only honest when the URL names the version being served. A
    // request without `v` (or with a stale one) points at whatever is current,
    // so caching it for a year would keep serving a replaced logo from
    // intermediaries long after the tenant changed it.
    res.setHeader(
      'Cache-Control',
      version === logo.id ? 'public, max-age=31536000, immutable' : 'public, max-age=60',
    );

    const stream = this.widgetLogo.openStream(Number(tenant.id), logo);
    stream.on('error', () => {
      // The theme says there is a logo but the file is gone (volume reset, manual
      // delete). Answer 404 rather than a half-written body; the widget falls
      // back to its text header on its own.
      if (!res.headersSent) res.status(HttpStatus.NOT_FOUND);
      res.end();
    });
    // pipe() does not close the source when the destination goes away. On a
    // public route every abandoned page load would leak a descriptor, and the
    // process reaches EMFILE long before anyone notices.
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }
}
