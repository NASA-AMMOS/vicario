package jpl.mipl.io.plugins;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.awt.Transparency;
import java.awt.color.ColorSpace;
import java.awt.image.BufferedImage;
import java.awt.image.ColorModel;
import java.awt.image.ComponentColorModel;
import java.awt.image.DataBuffer;
import java.awt.image.Raster;
import java.awt.image.WritableRaster;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;

import javax.imageio.IIOException;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriter;
import javax.imageio.spi.IIORegistry;
import javax.imageio.spi.ImageWriterSpi;
import javax.imageio.spi.ServiceRegistry;
import javax.imageio.stream.MemoryCacheImageOutputStream;

import org.junit.Test;

/**
 * vicario's PNM writer, which replaces jai_imageio 1.1's (it cannot load on Java 17+).
 */
public class PNMImageWriterTest {

    private static byte[] write(BufferedImage img) throws Exception {
        PNMImageWriterSpi.preferOver(IIORegistry.getDefaultInstance());
        ImageWriter w = ImageIO.getImageWritersByFormatName("pnm").next();
        assertTrue("pnm is served by vicario's writer, got " + w.getClass().getName(), w instanceof PNMImageWriter);
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        MemoryCacheImageOutputStream ios = new MemoryCacheImageOutputStream(bos);
        w.setOutput(ios);
        w.write(new IIOImage(img, null, null));
        ios.close();
        return bos.toByteArray();
    }

    private static byte[] concat(String header, byte[] samples) {
        byte[] h = header.getBytes(StandardCharsets.US_ASCII);
        byte[] all = new byte[h.length + samples.length];
        System.arraycopy(h, 0, all, 0, h.length);
        System.arraycopy(samples, 0, all, h.length, samples.length);
        return all;
    }

    @Test
    public void writesEightBitGrayAsP5() throws Exception {
        BufferedImage img = new BufferedImage(3, 2, BufferedImage.TYPE_BYTE_GRAY);
        img.getRaster().setPixels(0, 0, 3, 2, new int[] { 0, 1, 2, 253, 254, 255 });
        assertArrayEquals(concat("P5\n3 2\n255\n", new byte[] { 0, 1, 2, (byte) 253, (byte) 254, (byte) 255 }),
            write(img));
    }

    @Test
    public void writesSixteenBitRgbAsBigEndianP6() throws Exception {
        WritableRaster r = Raster.createInterleavedRaster(DataBuffer.TYPE_USHORT, 2, 1, 3, null);
        r.setPixels(0, 0, 2, 1, new int[] { 1, 256, 65535, 0, 2, 513 });
        ColorModel cm = new ComponentColorModel(ColorSpace.getInstance(ColorSpace.CS_sRGB),
            false, false, Transparency.OPAQUE, DataBuffer.TYPE_USHORT);
        BufferedImage img = new BufferedImage(cm, r, false, null);
        assertArrayEquals(concat("P6\n2 1\n65535\n", new byte[] {
            0, 1, 1, 0, (byte) 255, (byte) 255, 0, 0, 0, 2, 2, 1 }), write(img));
    }

    @Test
    public void refusesFourBands() throws Exception {
        BufferedImage img = new BufferedImage(2, 2, BufferedImage.TYPE_4BYTE_ABGR);
        try {
            write(img);
            fail("a 4-band image was written");
        } catch (IIOException e) {
            assertTrue(e.getMessage(), e.getMessage().contains("1 (PGM) or 3 (PPM) bands"));
        }
    }

    /** The jai_imageio provider is removed whichever of the two is registered first. */
    @Test
    public void preferOverRemovesTheJaiImageioWriter() throws Exception {
        ImageWriterSpi jai = (ImageWriterSpi) Class.forName(PNMImageWriterSpi.JAI_PNM_WRITER_SPI)
            .getDeclaredConstructor().newInstance();
        for (boolean jaiFirst : new boolean[] { true, false }) {
            ServiceRegistry reg = new ServiceRegistry(
                Collections.<Class<?>>singletonList(ImageWriterSpi.class).iterator());
            if (jaiFirst) reg.registerServiceProvider(jai, ImageWriterSpi.class);
            reg.registerServiceProvider(new PNMImageWriterSpi(), ImageWriterSpi.class);
            if (!jaiFirst) reg.registerServiceProvider(jai, ImageWriterSpi.class);
            PNMImageWriterSpi.preferOver(reg);
            List<String> left = new ArrayList<>();
            Iterator<ImageWriterSpi> it = reg.getServiceProviders(ImageWriterSpi.class, false);
            while (it.hasNext()) left.add(it.next().getClass().getName());
            assertEquals("jai registered first: " + jaiFirst,
                Collections.singletonList(PNMImageWriterSpi.class.getName()), left);
        }
    }
}
