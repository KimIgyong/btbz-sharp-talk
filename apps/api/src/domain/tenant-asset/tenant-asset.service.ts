import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import type { ReadStream } from 'fs';
import { join, normalize, resolve, sep } from 'path';
import {
  TENANT_ASSET_AREA,
  TENANT_ASSET_KIND,
  TenantAsset,
} from './entity/tenant-asset.entity';
import { AuditService } from '../audit/audit.service';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';
import { signFileUrl, verifyFileUrl } from '../../global/util/crypto.util';

export interface AssetUpload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface AssetActor {
  userId: number;
}

type SharpFactory = typeof import('sharp');

interface FormatSpec {
  ext: string;
  mime: string;
  sniff: (b: Buffer) => boolean;
}

interface KindSpec {
  formats: FormatSpec[];
  maxBytes: number;
  /** Raster images are re-encoded through sharp and bounded in pixels. */
  image?: { maxPx: number };
  /** Served without auth on the widget's public asset route (D-4). */
  public: boolean;
}

const startsWith = (b: Buffer, bytes: number[], offset = 0): boolean =>
  b.length >= offset + bytes.length && bytes.every((v, i) => b[offset + i] === v);
const ascii = (b: Buffer, text: string, offset = 0): boolean =>
  b.length >= offset + text.length && b.toString('latin1', offset, offset + text.length) === text;

const PNG: FormatSpec = { ext: 'png', mime: 'image/png', sniff: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]) };
const JPG: FormatSpec = { ext: 'jpg', mime: 'image/jpeg', sniff: (b) => startsWith(b, [0xff, 0xd8, 0xff]) };
const WEBP: FormatSpec = { ext: 'webp', mime: 'image/webp', sniff: (b) => ascii(b, 'RIFF') && ascii(b, 'WEBP', 8) };
const PDF: FormatSpec = { ext: 'pdf', mime: 'application/pdf', sniff: (b) => ascii(b, '%PDF-') };
// Font containers: woff2 'wOF2', TrueType 0x00010000 or 'true', OpenType 'OTTO'.
const WOFF2: FormatSpec = { ext: 'woff2', mime: 'font/woff2', sniff: (b) => ascii(b, 'wOF2') };
const TTF: FormatSpec = {
  ext: 'ttf',
  mime: 'font/ttf',
  sniff: (b) => startsWith(b, [0x00, 0x01, 0x00, 0x00]) || ascii(b, 'true'),
};
const OTF: FormatSpec = { ext: 'otf', mime: 'font/otf', sniff: (b) => ascii(b, 'OTTO') };

/** REQ/PLN D-3: what each kind accepts. svg/css/js/html never appear here on purpose. */
export const KIND_SPECS: Record<string, KindSpec> = {
  [TENANT_ASSET_KIND.FONT]: { formats: [WOFF2, TTF, OTF], maxBytes: 2 * 1024 * 1024, public: true },
  [TENANT_ASSET_KIND.ICON]: { formats: [PNG, WEBP], maxBytes: 256 * 1024, image: { maxPx: 512 }, public: true },
  [TENANT_ASSET_KIND.IMAGE]: { formats: [PNG, JPG, WEBP], maxBytes: 2 * 1024 * 1024, image: { maxPx: 2000 }, public: true },
  [TENANT_ASSET_KIND.DOC]: { formats: [PDF, PNG, JPG], maxBytes: 10 * 1024 * 1024, public: false },
};

/** Quota per area in MB; env-overridable so a plan tier can raise it later (PLN §7). */
const QUOTA_DEFAULT_MB: Record<string, number> = {
  [TENANT_ASSET_AREA.DESIGN]: 50,
  [TENANT_ASSET_AREA.SETTINGS]: 20,
};

const SIGNED_TTL_SEC = 15 * 60;

/**
 * Tenant asset store (PLN-260910 P1): files under
 * `UPLOAD_DIR/tenants/{tenantId}/{area}/{uuid}.{ext}` with one registry row each.
 *
 * Validation is by content, never by the client's filename or mimetype — a
 * ".woff2" that starts with "<svg" is an svg. Raster kinds are re-encoded
 * through sharp (strips metadata, bounds pixels) exactly like the widget logo.
 */
@Injectable()
export class TenantAssetService {
  private readonly logger = new Logger(TenantAssetService.name);
  private sharpModule: SharpFactory | null | undefined;

  constructor(
    @InjectRepository(TenantAsset) private readonly repo: Repository<TenantAsset>,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  // ---- paths --------------------------------------------------------------

  root(): string {
    return resolve(this.config.get<string>('UPLOAD_DIR', './.uploads'));
  }

  /** Tenant-root convention (D-1). */
  static relativeDir(tenantId: number, area: string): string {
    return join('tenants', String(tenantId), area);
  }

  private resolveInRoot(relative: string): string {
    const root = this.root();
    const full = resolve(root, normalize(relative));
    if (full !== root && !full.startsWith(root + sep)) {
      throw new BusinessException(ERROR_CODE.ATTACHMENT_STORAGE_FAILED, HttpStatus.BAD_REQUEST);
    }
    return full;
  }

  private sharp(): SharpFactory | null {
    if (this.sharpModule !== undefined) return this.sharpModule;
    try {
      this.sharpModule = require('sharp') as SharpFactory;
    } catch (err) {
      this.logger.warn(`sharp unavailable — raster assets disabled: ${String(err)}`);
      this.sharpModule = null;
    }
    return this.sharpModule;
  }

  quotaBytes(area: string): number {
    const envKey = `TENANT_ASSET_QUOTA_${area.toUpperCase()}_MB`;
    const mb = Number(this.config.get<string>(envKey)) || QUOTA_DEFAULT_MB[area] || 20;
    return mb * 1024 * 1024;
  }

  // ---- queries ------------------------------------------------------------

  async list(tenantId: number, q: { area?: string; kind?: string }): Promise<TenantAsset[]> {
    return this.repo.find({
      where: {
        tenantId,
        deletedAt: IsNull(),
        ...(q.area ? { area: q.area } : {}),
        ...(q.kind ? { kind: q.kind } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async usage(tenantId: number, area: string): Promise<{ used: number; quota: number }> {
    const row = await this.repo
      .createQueryBuilder('a')
      .select('COALESCE(SUM(a.size), 0)', 'used')
      .where('a.tenant_id = :tenantId AND a.area = :area AND a.deleted_at IS NULL', { tenantId, area })
      .getRawOne<{ used: string }>();
    return { used: Number(row?.used ?? 0), quota: this.quotaBytes(area) };
  }

  async get(tenantId: number, uuid: string): Promise<TenantAsset> {
    const row = await this.repo.findOne({ where: { tenantId, uuid, deletedAt: IsNull() } });
    if (!row) throw new BusinessException(ERROR_CODE.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);
    return row;
  }

  // ---- upload -------------------------------------------------------------

  async store(
    tenantId: number,
    input: { area: string; kind: string; label?: string },
    file: AssetUpload,
    actor: AssetActor,
  ): Promise<TenantAsset> {
    const spec = KIND_SPECS[input.kind];
    if (!spec || input.area !== TENANT_ASSET_AREA.DESIGN) {
      throw new BusinessException(ERROR_CODE.TENANT_ASSET_KIND_INVALID, HttpStatus.BAD_REQUEST);
    }
    if (!file?.buffer?.length) {
      throw new BusinessException(ERROR_CODE.TENANT_ASSET_UNSUPPORTED, HttpStatus.BAD_REQUEST);
    }
    if (file.buffer.length > spec.maxBytes) {
      this.logger.warn(`asset rejected: ${file.buffer.length} bytes > ${spec.maxBytes} (${input.kind}, tenant ${tenantId})`);
      throw new BusinessException(ERROR_CODE.TENANT_ASSET_TOO_LARGE, HttpStatus.BAD_REQUEST);
    }
    const head = file.buffer.subarray(0, 32);
    const format = spec.formats.find((f) => f.sniff(head));
    if (!format) {
      this.logger.warn(`asset rejected: content does not match ${input.kind} (tenant ${tenantId}, "${file.originalname}")`);
      throw new BusinessException(ERROR_CODE.TENANT_ASSET_UNSUPPORTED, HttpStatus.BAD_REQUEST);
    }

    let buffer = file.buffer;
    let width: number | null = null;
    let height: number | null = null;
    // Raster images are re-encoded (metadata stripped, pixels bounded). A PDF
    // "doc" or a font passes through byte-for-byte — there is nothing to strip.
    if (spec.image && format.mime.startsWith('image/')) {
      const sharp = this.sharp();
      if (!sharp) throw new BusinessException(ERROR_CODE.TENANT_ASSET_UNSUPPORTED, HttpStatus.BAD_REQUEST);
      try {
        const meta = await sharp(buffer).metadata();
        if ((meta.width ?? 0) > spec.image.maxPx || (meta.height ?? 0) > spec.image.maxPx) {
          throw new BusinessException(ERROR_CODE.TENANT_ASSET_DIMENSIONS, HttpStatus.BAD_REQUEST);
        }
        const out = sharp(buffer).rotate();
        const encoded =
          format.ext === 'png' ? out.png() : format.ext === 'webp' ? out.webp() : out.jpeg({ quality: 90 });
        const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
        buffer = data;
        width = info.width;
        height = info.height;
      } catch (e) {
        if (e instanceof BusinessException) throw e;
        this.logger.warn(`asset rejected: sharp could not decode (tenant ${tenantId}): ${(e as Error).message}`);
        throw new BusinessException(ERROR_CODE.TENANT_ASSET_UNSUPPORTED, HttpStatus.BAD_REQUEST);
      }
    }

    const { used, quota } = await this.usage(tenantId, input.area);
    if (used + buffer.length > quota) {
      this.logger.warn(`asset rejected: quota ${used + buffer.length} > ${quota} (${input.area}, tenant ${tenantId})`);
      throw new BusinessException(ERROR_CODE.TENANT_ASSET_QUOTA, HttpStatus.BAD_REQUEST);
    }

    const uuid = randomUUID();
    const rel = TenantAssetService.relativeDir(tenantId, input.area);
    const storagePath = join(rel, `${uuid}.${format.ext}`);
    await fs.mkdir(this.resolveInRoot(rel), { recursive: true });
    await fs.writeFile(this.resolveInRoot(storagePath), buffer);

    const row = await this.repo.save(
      this.repo.create({
        uuid,
        tenantId,
        area: input.area,
        kind: input.kind,
        filename: file.originalname.slice(0, 255),
        mime: format.mime,
        ext: format.ext,
        size: buffer.length,
        sha256: createHash('sha256').update(buffer).digest('hex'),
        width,
        height,
        storagePath,
        version: 1,
        label: input.label?.trim().slice(0, 128) || null,
        createdBy: actor.userId,
        deletedAt: null,
      }),
    );
    await this.audit.write({
      tenantId,
      actorType: 'user',
      actorId: actor.userId,
      action: 'tenant.asset_uploaded',
      target: `${input.area}/${input.kind}:${uuid}`,
      metadata: { filename: row.filename, size: row.size, mime: row.mime },
    });
    return row;
  }

  /**
   * A file the server produced (settings snapshot): no content sniffing —
   * the bytes are ours — but the same folder convention, quota and audit.
   */
  async storeGenerated(
    tenantId: number,
    input: { area: string; kind: string; filename: string; mime: string; ext: string; label?: string },
    buffer: Buffer,
    actor: AssetActor,
  ): Promise<TenantAsset> {
    const { used, quota } = await this.usage(tenantId, input.area);
    if (used + buffer.length > quota) {
      throw new BusinessException(ERROR_CODE.TENANT_ASSET_QUOTA, HttpStatus.BAD_REQUEST);
    }
    const uuid = randomUUID();
    const rel = TenantAssetService.relativeDir(tenantId, input.area);
    const storagePath = join(rel, `${uuid}.${input.ext}`);
    await fs.mkdir(this.resolveInRoot(rel), { recursive: true });
    await fs.writeFile(this.resolveInRoot(storagePath), buffer);
    const row = await this.repo.save(
      this.repo.create({
        uuid,
        tenantId,
        area: input.area,
        kind: input.kind,
        filename: input.filename.slice(0, 255),
        mime: input.mime,
        ext: input.ext,
        size: buffer.length,
        sha256: createHash('sha256').update(buffer).digest('hex'),
        width: null,
        height: null,
        storagePath,
        version: 1,
        label: input.label?.trim().slice(0, 128) || null,
        createdBy: actor.userId,
        deletedAt: null,
      }),
    );
    await this.audit.write({
      tenantId,
      actorType: 'user',
      actorId: actor.userId,
      action: 'tenant.asset_uploaded',
      target: `${input.area}/${input.kind}:${uuid}`,
      metadata: { filename: row.filename, size: row.size, mime: row.mime },
    });
    return row;
  }

  /** Whole file for server-side use (snapshot restore, package export). */
  async readBuffer(row: TenantAsset): Promise<Buffer> {
    return fs.readFile(this.resolveInRoot(row.storagePath));
  }

  // ---- delete -------------------------------------------------------------

  /** Soft-delete the row, then unlink the file — nothing else references P1 assets. */
  async remove(tenantId: number, uuid: string, actor: AssetActor): Promise<void> {
    const row = await this.get(tenantId, uuid);
    row.deletedAt = new Date();
    await this.repo.save(row);
    try {
      await fs.unlink(this.resolveInRoot(row.storagePath));
    } catch (e) {
      // A missing file is already the desired end state; log and move on.
      this.logger.warn(`asset unlink failed (${row.storagePath}): ${(e as Error).message}`);
    }
    await this.audit.write({
      tenantId,
      actorType: 'user',
      actorId: actor.userId,
      action: 'tenant.asset_deleted',
      target: `${row.area}/${row.kind}:${uuid}`,
      metadata: { filename: row.filename },
    });
  }

  // ---- serving ------------------------------------------------------------

  /** Public kinds are addressed by uuid alone; the version in the URL is the cache key (D-4). */
  async openPublic(uuid: string): Promise<{ stream: ReadStream; row: TenantAsset }> {
    const row = await this.repo.findOne({ where: { uuid, deletedAt: IsNull() } });
    if (!row || !KIND_SPECS[row.kind]?.public) {
      throw new BusinessException(ERROR_CODE.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return { stream: createReadStream(this.resolveInRoot(row.storagePath)), row };
  }

  /** Private kinds (doc) go through a short-lived signed URL, like chat attachments. */
  async openSigned(uuid: string, exp: number, sig: string): Promise<{ stream: ReadStream; row: TenantAsset }> {
    if (!verifyFileUrl(uuid, 'full', exp, sig)) {
      throw new BusinessException(ERROR_CODE.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    const row = await this.repo.findOne({ where: { uuid, deletedAt: IsNull() } });
    if (!row) throw new BusinessException(ERROR_CODE.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);
    return { stream: createReadStream(this.resolveInRoot(row.storagePath)), row };
  }

  /** URL the console (and, for public kinds, the widget) should use. */
  static urlFor(row: TenantAsset, now: number = Date.now()): string {
    if (KIND_SPECS[row.kind]?.public) {
      return `/api/v1/public/widget/asset/${row.uuid}?v=${row.version}`;
    }
    const exp = Math.floor(now / 1000) + SIGNED_TTL_SEC;
    return `/api/v1/tenant-assets/${row.uuid}/file?exp=${exp}&sig=${signFileUrl(row.uuid, 'full', exp)}`;
  }

  static isPublic(kind: string): boolean {
    return !!KIND_SPECS[kind]?.public;
  }
}
