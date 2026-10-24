package jpl.mipl.io.plugins;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.Iterator;

import javax.imageio.spi.ImageReaderSpi;
import javax.imageio.spi.ServiceRegistry;
import javax.imageio.stream.FileImageInputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;

import org.junit.Test;

import jpl.mipl.io.streams.FileChannelImageInputStream;
import jpl.mipl.io.vicar.VicarInputFile;

/**
 * Regression coverage for how vicario picks a reader and a stream:
 * <ul>
 * <li>NEW-isis-1: an ISIS2 qube is accepted by both ISISImageReaderSpi and
 * PDSImageReaderSpi. Without an ordering ImageIO picked either one, in an order
 * that changed from run to run, and the PDS reader wrote a 1x1 BYTE image.</li>
 * <li>REVIEW-18: VicarInputFile treated only javax FileImageInputStream as random
 * access, so seekable file streams (jConvertIIO's FileChannelImageInputStream,
 * imageio-ext's) were refused by the Magellan F-BIDR reader.</li>
 * </ul>
 */
public class ReaderSelectionTest {

    /** Reader SPIs in the order the registry hands them out. */
    private static String[] order(ImageReaderSpi first, ImageReaderSpi second) {
        ServiceRegistry registry = new ServiceRegistry(
            Arrays.<Class<?>>asList(ImageReaderSpi.class).iterator());
        registry.registerServiceProvider(first, ImageReaderSpi.class);
        registry.registerServiceProvider(second, ImageReaderSpi.class);
        Iterator<ImageReaderSpi> it = registry.getServiceProviders(ImageReaderSpi.class, true);
        return new String[] { it.next().getClass().getSimpleName(), it.next().getClass().getSimpleName() };
    }

    /**
     * Unordered providers come out in identity-hash order, so repeat with fresh
     * instances and both registration orders: without the ordering this fails
     * with near certainty.
     */
    @Test
    public void isisReaderIsOfferedBeforePdsReader() {
        String[] expected = { "ISISImageReaderSpi", "PDSImageReaderSpi" };
        for (int i = 0; i < 20; i++) {
            assertEquals(Arrays.asList(expected),
                Arrays.asList(order(new ISISImageReaderSpi(), new PDSImageReaderSpi())));
            assertEquals(Arrays.asList(expected),
                Arrays.asList(order(new PDSImageReaderSpi(), new ISISImageReaderSpi())));
        }
    }

    private static File vicarFile() throws Exception {
        File f = File.createTempFile("random-easy", ".vic");
        f.deleteOnExit();
        // 2-record label (RECSIZE=64), then 2 lines of 64 BYTE pixels
        byte[] label = new byte[128];
        Arrays.fill(label, (byte) ' ');
        byte[] text = "LBLSIZE=128  FORMAT='BYTE'  TYPE='IMAGE'  RECSIZE=64  ORG='BSQ'  NL=2  NS=64  NB=1"
            .getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(text, 0, label, 0, text.length);
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(label);
            out.write(new byte[128]);
        }
        return f;
    }

    @Test
    public void seekableFileStreamsAreRandomAccess() throws Exception {
        File f = vicarFile();
        try (RandomAccessFile raf = new RandomAccessFile(f, "r")) {
            VicarInputFile vif = new VicarInputFile();
            vif.open(new FileChannelImageInputStream(raf.getChannel()));
            assertTrue("FileChannelImageInputStream is random-access easy", vif.isRandomAccessEasy());
        }
        VicarInputFile vif = new VicarInputFile();
        vif.open(new FileImageInputStream(f));
        assertTrue("FileImageInputStream is random-access easy", vif.isRandomAccessEasy());
    }

    @Test
    public void cachedStreamIsNotRandomAccessEasy() throws Exception {
        byte[] bytes = Files.readAllBytes(vicarFile().toPath());
        VicarInputFile vif = new VicarInputFile();
        vif.open(new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes)));
        assertFalse("a stream backed by a cache is not random-access easy", vif.isRandomAccessEasy());
    }
}
