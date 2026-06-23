package com.sigaprinter;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;

import java.io.InputStream;
import java.net.URL;

/**
 * Decodes image URIs into raw RGBA pixel arrays.
 * Used by the JS ImageRasterizer to get pixel data
 * without needing a Canvas (not available in RN).
 */
@ReactModule(name = SigaPrinterImageDecoderModule.NAME)
public class SigaPrinterImageDecoderModule extends ReactContextBaseJavaModule {

    public static final String NAME = "SigaPrinterImageDecoder";

    public SigaPrinterImageDecoderModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    /**
     * Decode an image URI into RGBA bytes.
     * Returns { width, height, data: number[] } where data is RGBA interleaved.
     */
    @ReactMethod
    public void decode(String uri, Promise promise) {
        new Thread(() -> {
            try {
                Bitmap bitmap = loadBitmap(uri);
                if (bitmap == null) {
                    promise.reject("DECODE_ERROR", "Failed to decode image: " + uri);
                    return;
                }

                // Convert to ARGB_8888 for consistent pixel access
                Bitmap argb = bitmap.copy(Bitmap.Config.ARGB_8888, false);
                int w = argb.getWidth();
                int h = argb.getHeight();

                int[] pixels = new int[w * h];
                argb.getPixels(pixels, 0, w, 0, 0, w, h);

                // Pack into RGBA byte array
                WritableArray data = Arguments.createArray();
                for (int px : pixels) {
                    data.pushInt((px >> 16) & 0xff); // R
                    data.pushInt((px >>  8) & 0xff); // G
                    data.pushInt( px        & 0xff); // B
                    data.pushInt((px >> 24) & 0xff); // A
                }

                WritableMap result = Arguments.createMap();
                result.putInt("width",  w);
                result.putInt("height", h);
                result.putArray("data", data);

                bitmap.recycle();
                argb.recycle();

                promise.resolve(result);
            } catch (Exception e) {
                promise.reject("DECODE_ERROR", e.getMessage(), e);
            }
        }).start();
    }

    private Bitmap loadBitmap(String uri) throws Exception {
        if (uri.startsWith("data:")) {
            // Base64 data URI: data:image/png;base64,<data>
            String base64 = uri.substring(uri.indexOf(',') + 1);
            byte[] bytes  = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        }

        if (uri.startsWith("http://") || uri.startsWith("https://")) {
            InputStream is = new URL(uri).openStream();
            return BitmapFactory.decodeStream(is);
        }

        if (uri.startsWith("file://") || uri.startsWith("/")) {
            String path = uri.replace("file://", "");
            return BitmapFactory.decodeFile(path);
        }

        // Content URI (e.g. from MediaStore)
        Uri contentUri = Uri.parse(uri);
        InputStream is = getReactApplicationContext()
            .getContentResolver()
            .openInputStream(contentUri);
        return BitmapFactory.decodeStream(is);
    }
}
