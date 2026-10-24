package jpl.mipl.io.plugins;

import java.awt.image.DataBuffer;
import java.awt.image.SampleModel;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

import javax.imageio.ImageTypeSpecifier;
import javax.imageio.ImageWriter;
import javax.imageio.spi.ImageWriterSpi;
import javax.imageio.spi.ServiceRegistry;
import javax.imageio.stream.ImageOutputStream;

/**
 * Service provider for {@link PNMImageWriter}, registered for the format names
 * {@code pnm} and {@code PNM}.
 * <p>
 * jai_imageio 1.1 also registers a PNM writer, but it cannot be loaded on Java 17
 * and later (its static initialiser uses a JDK-internal class). This provider
 * removes that writer from the registry when it is registered, so a lookup of
 * "pnm" finds this one. Because the registry may load the jai_imageio provider
 * after this one, {@link #preferOver(ServiceRegistry)} can be called again
 * before a lookup.
 */
public class PNMImageWriterSpi extends ImageWriterSpi {

    /** The jai_imageio 1.1 PNM writer provider, which fails on Java 17+. */
    static final String JAI_PNM_WRITER_SPI = "com.sun.media.imageioimpl.plugins.pnm.PNMImageWriterSpi";

    private static final String[] names = { "pnm", "PNM" };
    private static final String[] suffixes = { "pnm", "ppm", "pgm" };
    private static final String[] MIMETypes = { "image/x-portable-anymap",
            "image/x-portable-pixmap", "image/x-portable-graymap" };

    public PNMImageWriterSpi() {
        super("Jet Propulsion Laboratory/MIPL", "1.0", names, suffixes, MIMETypes,
              "jpl.mipl.io.plugins.PNMImageWriter",
              new Class<?>[] { ImageOutputStream.class, OutputStream.class },
              null, false, null, null, null, null, false, null, null, null, null);
    }

    @Override
    public void onRegistration(ServiceRegistry registry, Class<?> category) {
        preferOver(registry);
    }

    /**
     * Deregisters the jai_imageio PNM writer provider, if registered, so that
     * this provider serves the PNM format names.
     *
     * @param registry the registry to clean, usually {@code IIORegistry.getDefaultInstance()}
     */
    public static void preferOver(ServiceRegistry registry) {
        List<ImageWriterSpi> broken = new ArrayList<>();
        Iterator<ImageWriterSpi> it = registry.getServiceProviders(ImageWriterSpi.class, false);
        while (it.hasNext()) {
            ImageWriterSpi spi = it.next();
            if (spi.getClass().getName().equals(JAI_PNM_WRITER_SPI)) {
                broken.add(spi);
            }
        }
        for (ImageWriterSpi spi : broken) {
            registry.deregisterServiceProvider(spi, ImageWriterSpi.class);
        }
    }

    @Override
    public boolean canEncodeImage(ImageTypeSpecifier type) {
        SampleModel sm = type.getSampleModel();
        int dataType = sm.getDataType();
        int bands = sm.getNumBands();
        return (bands == 1 || bands == 3)
            && (dataType == DataBuffer.TYPE_BYTE || dataType == DataBuffer.TYPE_USHORT
                || dataType == DataBuffer.TYPE_SHORT);
    }

    @Override
    public ImageWriter createWriterInstance(Object extension) {
        return new PNMImageWriter(this);
    }

    @Override
    public String getDescription(Locale locale) {
        return "PNM (PGM/PPM) binary image writer, 8 and 16 bit";
    }
}
