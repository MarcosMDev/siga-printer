package com.sigaprinter;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Renders landscape print elements to a portrait bitmap, then rotates 90° CW
 * to produce raster bytes for GS v 0 on Epson TM-T20X II (no native ESC V).
 *
 * Coordinate model:
 *   Portrait canvas: width = paperDots, height = accumulated content
 *   After 90° CW rotation: width = content, height = paperDots
 *   GS v 0: xBytes = ceil(content/8), yDots = paperDots
 */
public class LandscapeRenderer {

    public static class RowCell {
        public String text;
        public int widthPercent;
        public String align;
        public boolean bold;
    }

    // At 203 DPI, thermal font size=1 ≈ 12×24 dots. Use 24 px as base height.
    private static final int BASE_FONT_PX  = 24;
    private static final int LINE_GAP_PX   = 4;
    private static final int MARGIN_PX     = 8;
    private static final int SECTION_GAP   = 6;

    private final int paperDots;
    private final int innerWidth;

    private final List<Bitmap> strips = new ArrayList<>();
    private int totalHeight = 0;

    public LandscapeRenderer(int paperDots) {
        this.paperDots  = paperDots;
        this.innerWidth = paperDots - 2 * MARGIN_PX;
    }

    // ── Content methods ─────────────────────────────────────────

    @SuppressWarnings("deprecation")
    public void addText(String content, boolean bold, int size, String align,
                        boolean underline, boolean invert) {
        if (content == null || content.isEmpty()) {
            addFeed(1);
            return;
        }

        int fontSize = BASE_FONT_PX * Math.max(1, Math.min(size, 8));
        TextPaint tp  = makeTextPaint(fontSize, bold, underline, invert);
        Layout.Alignment la = toLayoutAlign(align);

        // deprecated constructor — works on API 21+
        StaticLayout layout = new StaticLayout(
                content, tp, innerWidth, la, 1f, LINE_GAP_PX, true);

        int h = layout.getHeight() + LINE_GAP_PX;
        Bitmap strip = whiteBitmap(paperDots, h);
        Canvas c = new Canvas(strip);
        if (invert) c.drawColor(Color.BLACK);
        c.translate(MARGIN_PX, 0);
        layout.draw(c);
        pushStrip(strip);
    }

    public void addDivider(String style, String customChar) {
        int h = BASE_FONT_PX + LINE_GAP_PX + SECTION_GAP * 2;
        Bitmap strip = whiteBitmap(paperDots, h);
        Canvas c = new Canvas(strip);

        float midY  = h / 2f;
        float left  = MARGIN_PX;
        float right = paperDots - MARGIN_PX;

        switch (style == null ? "line" : style) {
            case "empty":
                break;

            case "double": {
                Paint p = solidPaint(2f);
                c.drawLine(left, midY - 3, right, midY - 3, p);
                c.drawLine(left, midY + 3, right, midY + 3, p);
                break;
            }

            case "dashed": {
                Paint p = solidPaint(2f);
                p.setPathEffect(new DashPathEffect(new float[]{10f, 6f}, 0));
                c.drawLine(left, midY, right, midY, p);
                break;
            }

            case "dotted": {
                Paint p = solidPaint(2f);
                p.setPathEffect(new DashPathEffect(new float[]{3f, 5f}, 0));
                c.drawLine(left, midY, right, midY, p);
                break;
            }

            default: // "line"
                c.drawLine(left, midY, right, midY, solidPaint(2f));
                break;
        }

        pushStrip(strip);
    }

    public void addFeed(int lines) {
        int h = Math.max(4, lines * (BASE_FONT_PX + LINE_GAP_PX));
        pushStrip(whiteBitmap(paperDots, h));
    }

    @SuppressWarnings("deprecation")
    public void addRow(List<RowCell> cells) {
        if (cells == null || cells.isEmpty()) return;

        // Two-pass: first measure max line height across all cells
        List<StaticLayout> layouts = new ArrayList<>();
        int maxH = BASE_FONT_PX + LINE_GAP_PX;

        int xOffset = MARGIN_PX;
        for (RowCell cell : cells) {
            int cellW = Math.max(1, innerWidth * cell.widthPercent / 100);
            TextPaint tp = makeTextPaint(BASE_FONT_PX, cell.bold, false, false);
            Layout.Alignment la = toLayoutAlign(cell.align);
            StaticLayout sl = new StaticLayout(
                    cell.text == null ? "" : cell.text,
                    tp, cellW, la, 1f, LINE_GAP_PX, true);
            layouts.add(sl);
            if (sl.getHeight() > maxH) maxH = sl.getHeight();
        }

        int totalH = maxH + LINE_GAP_PX;
        Bitmap strip = whiteBitmap(paperDots, totalH);
        Canvas c = new Canvas(strip);

        xOffset = MARGIN_PX;
        for (int i = 0; i < cells.size(); i++) {
            RowCell cell  = cells.get(i);
            int cellW     = Math.max(1, innerWidth * cell.widthPercent / 100);
            StaticLayout sl = layouts.get(i);
            float topY    = (totalH - sl.getHeight()) / 2f;
            c.save();
            c.translate(xOffset, topY);
            sl.draw(c);
            c.restore();
            xOffset += cellW;
        }
        pushStrip(strip);
    }

    public void addBarcode(String data, String barcodeType, int height,
                           String align, boolean hriBelow) {
        try {
            BarcodeFormat format = toBarcodeFormat(barcodeType);
            Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
            hints.put(EncodeHintType.MARGIN, 0);

            int bW = (int) (innerWidth * 0.90);
            int bH = Math.max(20, Math.min(height, 150));

            BitMatrix matrix = new MultiFormatWriter().encode(data, format, bW, bH, hints);
            Bitmap barBmp = bitMatrixToBitmap(matrix);

            int hriH = hriBelow ? BASE_FONT_PX - 4 + LINE_GAP_PX : 0;
            int totalH = bH + hriH + SECTION_GAP * 2;
            Bitmap strip = whiteBitmap(paperDots, totalH);
            Canvas c = new Canvas(strip);

            c.drawBitmap(barBmp, alignX(bW, align), SECTION_GAP, null);

            if (hriBelow) {
                TextPaint tp = makeTextPaint(BASE_FONT_PX - 4, false, false, false);
                @SuppressWarnings("deprecation")
                StaticLayout sl = new StaticLayout(
                        data, tp, innerWidth, toLayoutAlign(align), 1f, 0f, false);
                c.save();
                c.translate(MARGIN_PX, SECTION_GAP + bH + 2);
                sl.draw(c);
                c.restore();
            }

            barBmp.recycle();
            pushStrip(strip);
        } catch (Exception e) {
            addText("[BARCODE:" + data + "]", false, 1, "center", false, false);
        }
    }

    public void addQRCode(String data, int moduleSize, String errorLevel, String align) {
        try {
            Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
            hints.put(EncodeHintType.MARGIN, 1);
            hints.put(EncodeHintType.ERROR_CORRECTION, parseErrorLevel(errorLevel));
            hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");

            int qrPx = Math.min(moduleSize * 20, innerWidth);
            BitMatrix matrix = new MultiFormatWriter()
                    .encode(data, BarcodeFormat.QR_CODE, qrPx, qrPx, hints);
            Bitmap qrBmp = bitMatrixToBitmap(matrix);

            int totalH = qrPx + SECTION_GAP * 2;
            Bitmap strip = whiteBitmap(paperDots, totalH);
            new Canvas(strip).drawBitmap(qrBmp, alignX(qrPx, align), SECTION_GAP, null);

            qrBmp.recycle();
            pushStrip(strip);
        } catch (Exception e) {
            addText("[QR:" + data + "]", false, 1, "center", false, false);
        }
    }

    /**
     * Draws a 1-bit raster image (MSB first, packed 8px/byte) onto the canvas.
     * bytes[] values are unsigned (0-255). widthBytes × 8 = pixel width.
     */
    public void addImage(int[] bytes, int widthBytes, int heightDots, String align) {
        int widthDots = widthBytes * 8;
        int[] pixels = new int[widthDots * heightDots];

        for (int y = 0; y < heightDots; y++) {
            for (int bx = 0; bx < widthBytes; bx++) {
                int b = bytes[y * widthBytes + bx] & 0xff;
                for (int bit = 0; bit < 8; bit++) {
                    int x = bx * 8 + bit;
                    if (x < widthDots) {
                        pixels[y * widthDots + x] =
                                ((b & (0x80 >> bit)) != 0) ? Color.BLACK : Color.WHITE;
                    }
                }
            }
        }

        Bitmap imgBmp = Bitmap.createBitmap(widthDots, heightDots, Bitmap.Config.ARGB_8888);
        imgBmp.setPixels(pixels, 0, widthDots, 0, 0, widthDots, heightDots);

        int drawW = Math.min(widthDots, innerWidth);
        int totalH = heightDots + SECTION_GAP * 2;
        Bitmap strip = whiteBitmap(paperDots, totalH);
        new Canvas(strip).drawBitmap(imgBmp, alignX(drawW, align), SECTION_GAP, null);

        imgBmp.recycle();
        pushStrip(strip);
    }

    // ── Finalize ─────────────────────────────────────────────────

    /**
     * Compose all strips → portrait bitmap → rotate 90° CW → GS v 0 bytes.
     */
    public byte[] finish() {
        int fullH = totalHeight + MARGIN_PX;

        Bitmap portrait = Bitmap.createBitmap(paperDots, fullH, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(portrait);
        c.drawColor(Color.WHITE);

        int y = MARGIN_PX / 2;
        for (Bitmap strip : strips) {
            c.drawBitmap(strip, 0, y, null);
            y += strip.getHeight();
            strip.recycle();
        }
        strips.clear();

        Matrix m = new Matrix();
        m.postRotate(90);
        Bitmap rotated = Bitmap.createBitmap(portrait, 0, 0,
                portrait.getWidth(), portrait.getHeight(), m, false);
        portrait.recycle();

        byte[] result = toGsV0(rotated);
        rotated.recycle();
        return result;
    }

    // ── Helpers ───────────────────────────────────────────────────

    private void pushStrip(Bitmap strip) {
        strips.add(strip);
        totalHeight += strip.getHeight();
    }

    private Bitmap whiteBitmap(int w, int h) {
        Bitmap bmp = Bitmap.createBitmap(w, Math.max(h, 1), Bitmap.Config.ARGB_8888);
        bmp.eraseColor(Color.WHITE);
        return bmp;
    }

    private TextPaint makeTextPaint(int sizePx, boolean bold, boolean underline, boolean invert) {
        TextPaint tp = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        tp.setTextSize(sizePx);
        tp.setTypeface(Typeface.create(Typeface.MONOSPACE,
                bold ? Typeface.BOLD : Typeface.NORMAL));
        tp.setColor(invert ? Color.WHITE : Color.BLACK);
        if (underline) tp.setUnderlineText(true);
        return tp;
    }

    private Paint solidPaint(float strokeW) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(Color.BLACK);
        p.setStrokeWidth(strokeW);
        p.setStyle(Paint.Style.STROKE);
        return p;
    }

    private Layout.Alignment toLayoutAlign(String align) {
        if ("center".equals(align)) return Layout.Alignment.ALIGN_CENTER;
        if ("right".equals(align))  return Layout.Alignment.ALIGN_OPPOSITE;
        return Layout.Alignment.ALIGN_NORMAL;
    }

    private int alignX(int contentW, String align) {
        if ("center".equals(align)) return MARGIN_PX + (innerWidth - contentW) / 2;
        if ("right".equals(align))  return Math.max(0, paperDots - MARGIN_PX - contentW);
        return MARGIN_PX;
    }

    private BarcodeFormat toBarcodeFormat(String type) {
        if (type == null) return BarcodeFormat.CODE_128;
        switch (type.toUpperCase()) {
            case "EAN13":   return BarcodeFormat.EAN_13;
            case "EAN8":    return BarcodeFormat.EAN_8;
            case "CODE39":  return BarcodeFormat.CODE_39;
            case "CODE93":  return BarcodeFormat.CODE_93;
            case "ITF":
            case "ITF25":   return BarcodeFormat.ITF;
            case "CODABAR": return BarcodeFormat.CODABAR;
            case "UPC_A":   return BarcodeFormat.UPC_A;
            case "UPC_E":   return BarcodeFormat.UPC_E;
            default:        return BarcodeFormat.CODE_128;
        }
    }

    private ErrorCorrectionLevel parseErrorLevel(String l) {
        if ("H".equals(l)) return ErrorCorrectionLevel.H;
        if ("Q".equals(l)) return ErrorCorrectionLevel.Q;
        if ("M".equals(l)) return ErrorCorrectionLevel.M;
        return ErrorCorrectionLevel.L;
    }

    private Bitmap bitMatrixToBitmap(BitMatrix m) {
        int w = m.getWidth(), h = m.getHeight();
        int[] px = new int[w * h];
        for (int row = 0; row < h; row++)
            for (int col = 0; col < w; col++)
                px[row * w + col] = m.get(col, row) ? Color.BLACK : Color.WHITE;
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        bmp.setPixels(px, 0, w, 0, 0, w, h);
        return bmp;
    }

    /**
     * Converts a Bitmap to GS v 0 raster command bytes.
     * m=0 (normal density), MSB first, 1 = black dot.
     */
    private byte[] toGsV0(Bitmap bmp) {
        int wDots = bmp.getWidth();
        int hDots = bmp.getHeight();
        int wBytes = (wDots + 7) / 8;

        byte[] out = new byte[8 + wBytes * hDots];
        out[0] = 0x1d; out[1] = 0x76; out[2] = 0x30; out[3] = 0x00;
        out[4] = (byte)(wBytes & 0xff);
        out[5] = (byte)((wBytes >> 8) & 0xff);
        out[6] = (byte)(hDots & 0xff);
        out[7] = (byte)((hDots >> 8) & 0xff);

        int[] pixels = new int[wDots * hDots];
        bmp.getPixels(pixels, 0, wDots, 0, 0, wDots, hDots);

        for (int row = 0; row < hDots; row++) {
            for (int bx = 0; bx < wBytes; bx++) {
                byte b = 0;
                for (int bit = 0; bit < 8; bit++) {
                    int x = bx * 8 + bit;
                    if (x < wDots && (pixels[row * wDots + x] & 0xffffff) < 0x808080) {
                        b |= (byte)(0x80 >> bit);
                    }
                }
                out[8 + row * wBytes + bx] = b;
            }
        }
        return out;
    }
}
