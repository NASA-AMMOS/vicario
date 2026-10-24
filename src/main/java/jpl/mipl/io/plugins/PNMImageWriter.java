package jpl.mipl.io.plugins;

import java.awt.Rectangle;
import java.awt.image.DataBuffer;
import java.awt.image.Raster;
import java.awt.image.RenderedImage;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import javax.imageio.IIOException;
import javax.imageio.IIOImage;
import javax.imageio.ImageTypeSpecifier;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.metadata.IIOMetadata;
import javax.imageio.spi.ImageWriterSpi;
import javax.imageio.stream.ImageOutputStream;

/**
 * Writes binary PNM files: PGM ({@code P5}) for one band and PPM ({@code P6})
 * for three bands, with 8-bit (BYTE, maxval 255) or 16-bit (USHORT or SHORT,
 * maxval 65535, big-endian as the format requires) samples. Negative SHORT
 * samples are written as 0. Other band counts and data types are refused with
 * an {@link IIOException}; convert them first (for example with OFORM).
 * <p>
 * Replaces the jai_imageio 1.1 PNM writer, which cannot be loaded on Java 17+.
 * The whole image is written; the write param, metadata and thumbnails are ignored.
 */
public class PNMImageWriter extends ImageWriter {

    public PNMImageWriter(ImageWriterSpi originatingProvider) {
        super(originatingProvider);
    }

    @Override
    public IIOMetadata getDefaultStreamMetadata(ImageWriteParam param) {
        return null;
    }

    @Override
    public IIOMetadata getDefaultImageMetadata(ImageTypeSpecifier imageType, ImageWriteParam param) {
        return null;
    }

    @Override
    public IIOMetadata convertStreamMetadata(IIOMetadata inData, ImageWriteParam param) {
        return null;
    }

    @Override
    public IIOMetadata convertImageMetadata(IIOMetadata inData, ImageTypeSpecifier imageType,
                                            ImageWriteParam param) {
        return null;
    }

    @Override
    public void write(IIOMetadata streamMetadata, IIOImage image, ImageWriteParam param) throws IOException {
        Object output = getOutput();
        if (output == null) {
            throw new IllegalStateException("PNM writer: output not set");
        }
        if (image == null || image.getRenderedImage() == null) {
            throw new IllegalArgumentException("PNM writer: no rendered image to write");
        }
        RenderedImage ri = image.getRenderedImage();
        int bands = ri.getSampleModel().getNumBands();
        int dataType = ri.getSampleModel().getDataType();
        if (bands != 1 && bands != 3) {
            throw new IIOException("PNM holds 1 (PGM) or 3 (PPM) bands; this image has " + bands);
        }
        boolean sixteen;
        if (dataType == DataBuffer.TYPE_BYTE) {
            sixteen = false;
        } else if (dataType == DataBuffer.TYPE_USHORT || dataType == DataBuffer.TYPE_SHORT) {
            sixteen = true;
        } else {
            throw new IIOException("PNM holds 8- or 16-bit integer samples; convert this image with OFORM first");
        }

        int w = ri.getWidth();
        int h = ri.getHeight();
        String header = (bands == 1 ? "P5" : "P6") + "\n" + w + " " + h + "\n" + (sixteen ? 65535 : 255) + "\n";
        put(output, header.getBytes(StandardCharsets.US_ASCII));

        int bytesPerSample = sixteen ? 2 : 1;
        int[] samples = new int[w * bands];
        byte[] row = new byte[w * bands * bytesPerSample];
        int x0 = ri.getMinX();
        for (int y = ri.getMinY(); y < ri.getMinY() + h; y++) {
            Raster r = ri.getData(new Rectangle(x0, y, w, 1));
            r.getPixels(x0, y, w, 1, samples);
            for (int i = 0; i < samples.length; i++) {
                int v = samples[i];
                if (sixteen) {
                    if (v < 0) v = 0; // signed SHORT: PNM samples are unsigned
                    row[2 * i] = (byte) (v >> 8);
                    row[2 * i + 1] = (byte) v;
                } else {
                    row[i] = (byte) v;
                }
            }
            put(output, row);
            if (abortRequested()) {
                processWriteAborted();
                return;
            }
        }
        if (output instanceof OutputStream) {
            ((OutputStream) output).flush();
        } else {
            ((ImageOutputStream) output).flush();
        }
    }

    private static void put(Object output, byte[] b) throws IOException {
        if (output instanceof OutputStream) {
            ((OutputStream) output).write(b);
        } else {
            ((ImageOutputStream) output).write(b);
        }
    }
}
