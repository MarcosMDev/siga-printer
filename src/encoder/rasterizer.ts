import { Platform } from 'react-native';
import type { PrinterProfile } from '../types';
import type { ImageDitherMode } from '../types';

interface RasterizeOptions {
  targetWidth?:  number;
  targetHeight?: number;
  dither:        ImageDitherMode;
  threshold:     number;
}

interface RasterResult {
  widthBytes:  number;
  heightDots:  number;
  pixels:      Uint8Array;
}

// ─────────────────────────────────────────────────────────────
//  ImageRasterizer
//
//  Converts an image (URI, require(), base64) into a packed
//  1-bit raster bitmap suitable for GS v 0 (ESC/POS).
//
//  Pipeline:
//    load → resize → grayscale → dither → pack bits → Uint8Array
//
//  Also handles landscape printing by rotating the canvas 90°
//  before rasterizing (used on TM-T20X which lacks ESC V).
// ─────────────────────────────────────────────────────────────

export class ImageRasterizer {
  private profile: PrinterProfile;

  constructor(profile: PrinterProfile) {
    this.profile = profile;
  }

  async rasterize(
    source:  string | number,
    options: RasterizeOptions,
  ): Promise<RasterResult> {
    const maxWidth = options.targetWidth ?? this.profile.dotsPerLine;

    // Load image into a pixel buffer using React Native's Image API
    const { width: srcW, height: srcH, data: rgba } =
      await this._loadImage(source);

    // Compute target dimensions
    const scale = Math.min(1, maxWidth / srcW);
    const dstW  = options.targetWidth  ?? Math.round(srcW * scale);
    const dstH  = options.targetHeight ?? Math.round(srcH * scale);

    // Resize with bilinear interpolation
    const resized = this._bilinearResize(rgba, srcW, srcH, dstW, dstH);

    // Convert to grayscale float [0..1]
    const gray = this._toGrayscale(resized, dstW, dstH);

    // Apply dithering
    const bw = this._dither(gray, dstW, dstH, options.dither, options.threshold);

    // Pack 8 pixels per byte (MSB first)
    return this._packBits(bw, dstW, dstH);
  }

  /**
   * renderLandscape — rasterize content as a 90°-rotated image.
   * Used on TM-T20X and other printers that don't support ESC V.
   *
   * The caller provides the portrait-orientation pixel content,
   * and this method rotates the packed bitmap 90° clockwise so
   * that the physical paper feeds through in the correct direction.
   *
   * For full landscape printing (e.g. a 80mm-wide slip printed
   * sideways), the content should be pre-rendered at the rotated
   * dimensions before calling rasterize().
   */
  async renderLandscape(
    source:  string | number,
    options: RasterizeOptions,
  ): Promise<RasterResult> {
    // For landscape: treat paper height as width
    // A standard 80mm roll at 203dpi ≈ 576 dots wide (portrait)
    // In landscape the image height can be arbitrary (paper length)
    // and width must fit in 576 dots (now the "height" axis)

    const portraitResult = await this.rasterize(source, {
      ...options,
      // Swap target dims if both provided
      targetWidth:  options.targetHeight,
      targetHeight: options.targetWidth,
    });

    return this._rotateBitmap90CW(portraitResult);
  }

  // ── Private: load image ─────────────────────────────────────

  private async _loadImage(source: string | number): Promise<{
    width: number; height: number; data: Uint8ClampedArray;
  }> {
    // In React Native we use a native module or canvas to decode images.
    // This implementation delegates to the native ThermalPrinter module
    // via a promise-based bridge exposed as NativeImageDecoder.
    //
    // The native side (Android: BitmapFactory, iOS: UIImage) returns
    // raw RGBA bytes, width, and height.
    //
    // For web/testing environments, we fall back to a Canvas approach.
    //
    // NOTE: This function is intentionally left as a stub here.
    // The native module (see android/src and ios/ directories)
    // implements the actual decoding.

    const { NativeModules } = require('react-native');

    if (NativeModules.ThermalPrinterImageDecoder) {
      const uri = typeof source === 'number'
        ? await this._resolveAssetUri(source)
        : source;
      return NativeModules.ThermalPrinterImageDecoder.decode(uri);
    }

    // Fallback for dev/testing: create a white 1x1 pixel
    console.warn('[ThermalPrinter] NativeImageDecoder not available, using stub');
    return { width: 1, height: 1, data: new Uint8ClampedArray([255, 255, 255, 255]) };
  }

  private async _resolveAssetUri(assetId: number): Promise<string> {
    const resolveAssetSource = require('react-native/Libraries/Image/resolveAssetSource');
    const resolved = resolveAssetSource(assetId);
    return resolved?.uri ?? '';
  }

  // ── Private: bilinear resize ────────────────────────────────

  private _bilinearResize(
    src: Uint8ClampedArray,
    srcW: number, srcH: number,
    dstW: number, dstH: number,
  ): Uint8ClampedArray {
    const dst   = new Uint8ClampedArray(dstW * dstH * 4);
    const scaleX = srcW / dstW;
    const scaleY = srcH / dstH;

    for (let y = 0; y < dstH; y++) {
      for (let x = 0; x < dstW; x++) {
        const srcX = x * scaleX;
        const srcY = y * scaleY;
        const x0   = Math.floor(srcX);
        const y0   = Math.floor(srcY);
        const x1   = Math.min(x0 + 1, srcW - 1);
        const y1   = Math.min(y0 + 1, srcH - 1);
        const fx   = srcX - x0;
        const fy   = srcY - y0;

        const dstI = (y * dstW + x) * 4;

        for (let c = 0; c < 4; c++) {
          const t00 = src[(y0 * srcW + x0) * 4 + c];
          const t10 = src[(y0 * srcW + x1) * 4 + c];
          const t01 = src[(y1 * srcW + x0) * 4 + c];
          const t11 = src[(y1 * srcW + x1) * 4 + c];
          dst[dstI + c] = Math.round(
            t00 * (1 - fx) * (1 - fy) +
            t10 * fx       * (1 - fy) +
            t01 * (1 - fx) * fy       +
            t11 * fx       * fy,
          );
        }
      }
    }

    return dst;
  }

  // ── Private: grayscale ──────────────────────────────────────

  private _toGrayscale(
    rgba: Uint8ClampedArray,
    w: number, h: number,
  ): Float32Array {
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const r = rgba[i * 4];
      const g = rgba[i * 4 + 1];
      const b = rgba[i * 4 + 2];
      const a = rgba[i * 4 + 3] / 255;
      // Luminance formula (ITU-R BT.601)
      // Pre-multiply alpha against white background
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      gray[i] = lum * a + (1 - a); // blend over white
    }
    return gray;
  }

  // ── Private: dithering ──────────────────────────────────────

  private _dither(
    gray:      Float32Array,
    w:         number,
    h:         number,
    mode:      ImageDitherMode,
    threshold: number,
  ): Uint8Array {
    switch (mode) {
      case 'floyd-steinberg': return this._floydSteinberg(gray, w, h);
      case 'atkinson':        return this._atkinson(gray, w, h);
      case 'bayer':           return this._bayer(gray, w, h);
      default:                return this._threshold(gray, threshold);
    }
  }

  private _threshold(gray: Float32Array, t: number): Uint8Array {
    const bw = new Uint8Array(gray.length);
    for (let i = 0; i < gray.length; i++) {
      bw[i] = gray[i] < t ? 1 : 0; // 1 = black dot
    }
    return bw;
  }

  private _floydSteinberg(gray: Float32Array, w: number, h: number): Uint8Array {
    const buf = new Float32Array(gray); // mutable copy
    const bw  = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i   = y * w + x;
        const old = buf[i];
        const nw  = old < 0.5 ? 0.0 : 1.0;
        bw[i]     = nw === 0.0 ? 1 : 0; // 1 = black
        const err = old - nw;

        if (x + 1 < w)           buf[i + 1]         += err * 7 / 16;
        if (y + 1 < h) {
          if (x > 0)             buf[i + w - 1]      += err * 3 / 16;
                                 buf[i + w]           += err * 5 / 16;
          if (x + 1 < w)        buf[i + w + 1]       += err * 1 / 16;
        }
      }
    }

    return bw;
  }

  private _atkinson(gray: Float32Array, w: number, h: number): Uint8Array {
    const buf = new Float32Array(gray);
    const bw  = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i   = y * w + x;
        const old = buf[i];
        const nw  = old < 0.5 ? 0.0 : 1.0;
        bw[i]     = nw === 0.0 ? 1 : 0;
        const err = (old - nw) / 8;

        const neighbors = [
          [0, 1], [0, 2],
          [1, -1], [1, 0], [1, 1],
          [2, 0],
        ];
        for (const [dy, dx] of neighbors) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            buf[ny * w + nx] += err;
          }
        }
      }
    }

    return bw;
  }

  private _bayer(gray: Float32Array, w: number, h: number): Uint8Array {
    // 4x4 Bayer ordered dithering matrix (normalized 0..1)
    const BAYER_4X4 = [
      [ 0, 8, 2,10],
      [12, 4,14, 6],
      [ 3,11, 1, 9],
      [15, 7,13, 5],
    ].map(row => row.map(v => v / 16));

    const bw = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const threshold = BAYER_4X4[y % 4][x % 4];
        bw[y * w + x] = gray[y * w + x] < threshold ? 1 : 0;
      }
    }
    return bw;
  }

  // ── Private: pack bits ──────────────────────────────────────

  private _packBits(bw: Uint8Array, w: number, h: number): RasterResult {
    // ESC/POS expects pixels packed 8-per-byte, MSB first.
    // Width must be padded to a multiple of 8.
    const widthBytes = Math.ceil(w / 8);
    const paddedW    = widthBytes * 8;
    const pixels     = new Uint8Array(widthBytes * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (bw[y * w + x]) {
          const byteI  = y * widthBytes + Math.floor(x / 8);
          const bitPos = 7 - (x % 8); // MSB first
          pixels[byteI] |= (1 << bitPos);
        }
      }
    }

    return { widthBytes, heightDots: h, pixels };
  }

  // ── Private: rotate 90° CW ──────────────────────────────────

  private _rotateBitmap90CW(input: RasterResult): RasterResult {
    const { widthBytes, heightDots, pixels } = input;
    const srcW = widthBytes * 8;
    const srcH = heightDots;

    // Unpack to individual bits
    const unpacked = new Uint8Array(srcW * srcH);
    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const byteI  = y * widthBytes + Math.floor(x / 8);
        const bitPos = 7 - (x % 8);
        unpacked[y * srcW + x] = (pixels[byteI] >> bitPos) & 1;
      }
    }

    // Rotate 90° CW: (x, y) → (srcH - 1 - y, x)
    // New dimensions: dstW = srcH, dstH = srcW
    const dstW      = srcH;
    const dstH      = srcW;
    const rotated   = new Uint8Array(dstW * dstH);

    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const nx = srcH - 1 - y;
        const ny = x;
        rotated[ny * dstW + nx] = unpacked[y * srcW + x];
      }
    }

    return this._packBits(rotated, dstW, dstH);
  }
}
