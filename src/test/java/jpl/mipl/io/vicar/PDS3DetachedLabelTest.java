package jpl.mipl.io.vicar;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.awt.image.Raster;
import java.io.File;
import java.io.FileOutputStream;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

import javax.imageio.IIOImage;
import javax.imageio.metadata.IIOMetadata;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.w3c.dom.Element;
import org.w3c.dom.Node;

import jpl.mipl.io.ImageUtils;
import jpl.mipl.io.streams.FileChannelImageInputStream;

/**
 * Regression coverage for REVIEW-7 and NEW-pds3-1: reading a product through a
 * detached PDS3 label whose ^IMAGE_HEADER points at a VICAR label inside the
 * data file, e.g. ^IMAGE_HEADER = ("X.IMG",3).
 * <ul>
 * <li>REVIEW-7: the embedded VICAR label was read from the label file before the
 * data file was opened. When the pointer lies past the end of the label file
 * (MSL Navcam .LBL), FileChannelImageInputStream threw "Negative size" and
 * jConvertIIO crashed.</li>
 * <li>NEW-pds3-1: when the pointer lies inside the label file (Cassini ISS .lbl,
 * record 1), the embedded VICAR label silently went missing from the metadata.</li>
 * </ul>
 * Each test writes a small data file (padding, a VICAR label, 2 lines of BYTE
 * pixels) and its detached label into a temp directory and reads the label the
 * way jConvertIIO does (ImageUtils.fullRead).
 */
public class PDS3DetachedLabelTest {

    private static final int RECORD_BYTES = 512;
    private static final int LINES = 2;

    private File tempDir;

    @Before
    public void setUp() throws Exception {
        tempDir = Files.createTempDirectory("pds3-detached-test").toFile();
    }

    @After
    public void tearDown() throws Exception {
        if (tempDir != null) {
            File[] kids = tempDir.listFiles();
            if (kids != null) {
                for (File f : kids) f.delete();
            }
            tempDir.delete();
        }
    }

    /** A record of text padded with blanks. */
    private static byte[] record(String text) {
        byte[] r = new byte[RECORD_BYTES];
        java.util.Arrays.fill(r, (byte) ' ');
        byte[] t = text.getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(t, 0, r, 0, t.length);
        return r;
    }

    /**
     * Data file: padRecords blank records, a one-record VICAR label (with
     * MISSION_NAME and INSTRUMENT_ID), then LINES lines of pixels (x + 7*y) & 0xff.
     */
    private File writeDataFile(String name, int padRecords) throws Exception {
        File f = new File(tempDir, name);
        try (FileOutputStream out = new FileOutputStream(f)) {
            for (int i = 0; i < padRecords; i++) out.write(record(""));
            out.write(record("LBLSIZE=" + RECORD_BYTES + "             FORMAT='BYTE'  TYPE='IMAGE'  BUFSIZ="
                + RECORD_BYTES + "  DIM=3  EOL=0  RECSIZE=" + RECORD_BYTES + "  ORG='BSQ'  NL=" + LINES
                + "  NS=" + RECORD_BYTES + "  NB=1  N1=" + RECORD_BYTES + "  N2=" + LINES + "  N3=1  N4=0  NBB=0"
                + "  NLB=0  HOST='JAVA'  INTFMT='HIGH'  REALFMT='IEEE'  BHOST='JAVA'  BINTFMT='HIGH'"
                + "  BREALFMT='IEEE'  BLTYPE=''  PROPERTY='IDENTIFICATION'  MISSION_NAME='TESTMISSION'"
                + "  INSTRUMENT_ID='TESTCAM'"));
            byte[] line = new byte[RECORD_BYTES];
            for (int y = 0; y < LINES; y++) {
                for (int x = 0; x < RECORD_BYTES; x++) line[x] = (byte) (x + 7 * y);
                out.write(line);
            }
        }
        return f;
    }

    /** Detached label pointing at the VICAR label and the image inside dataName. */
    private File writeDetachedLabel(String name, String dataName, int headerRecord) throws Exception {
        String lbl = "PDS_VERSION_ID                  = PDS3\r\n"
            + "RECORD_TYPE                     = FIXED_LENGTH\r\n"
            + "RECORD_BYTES                    = " + RECORD_BYTES + "\r\n"
            + "FILE_RECORDS                    = " + (headerRecord + LINES) + "\r\n"
            + "^IMAGE_HEADER                   = (\"" + dataName + "\"," + headerRecord + ")\r\n"
            + "^IMAGE                          = (\"" + dataName + "\"," + (headerRecord + 1) + ")\r\n"
            + "OBJECT                          = IMAGE\r\n"
            + "  LINES                         = " + LINES + "\r\n"
            + "  LINE_SAMPLES                  = " + RECORD_BYTES + "\r\n"
            + "  BANDS                         = 1\r\n"
            + "  SAMPLE_BITS                   = 8\r\n"
            + "  SAMPLE_TYPE                   = UNSIGNED_INTEGER\r\n"
            + "  BAND_STORAGE_TYPE             = BAND_SEQUENTIAL\r\n"
            + "END_OBJECT                      = IMAGE\r\n"
            + "END\r\n";
        File f = new File(tempDir, name);
        Files.write(f.toPath(), lbl.getBytes(StandardCharsets.US_ASCII));
        return f;
    }

    /** Read as jConvertIIO does: ImageUtils picks the reader and opens the stream. */
    private static IIOImage read(File label) throws Exception {
        ImageUtils imUtil = new ImageUtils(label.getPath());
        imUtil.setGetAsRenderedImage(true);
        IIOImage image = imUtil.fullRead(label.getPath());
        assertNotNull("read " + label.getName(), image);
        return image;
    }

    private static void assertPixels(IIOImage image) {
        Raster r = image.getRenderedImage().getData();
        assertEquals(RECORD_BYTES, r.getWidth());
        assertEquals(LINES, r.getHeight());
        for (int y = 0; y < LINES; y++) {
            for (int x = 0; x < RECORD_BYTES; x += 37) {
                assertEquals("pixel " + x + "," + y, (x + 7 * y) & 0xff, r.getSample(x, y, 0));
            }
        }
    }

    /** Value of the first element whose key or name attribute is item, or null. */
    private static String findItem(Node n, String item) {
        if (n instanceof Element) {
            Element e = (Element) n;
            if (item.equals(e.getAttribute("key")) || item.equals(e.getAttribute("name"))) {
                // VicarLabelItem.toXML keeps a single value in the value attribute
                return e.hasAttribute("value") ? e.getAttribute("value") : e.getTextContent().trim();
            }
        }
        for (Node c = n.getFirstChild(); c != null; c = c.getNextSibling()) {
            String v = findItem(c, item);
            if (v != null) return v;
        }
        return null;
    }

    private static Node embeddedVicarLabel(IIOImage image) {
        IIOMetadata m = image.getMetadata();
        assertNotNull("metadata", m);
        Node tree = m.getAsTree("VICAR_LABEL");
        assertNotNull("embedded VICAR label in the metadata", tree);
        return tree;
    }

    /** REVIEW-7: ^IMAGE_HEADER past the end of the label file (MSL Navcam .LBL). */
    @Test
    public void headerPointerPastEndOfLabelFile() throws Exception {
        writeDataFile("PAST.IMG", 2);
        File lbl = writeDetachedLabel("PAST.LBL", "PAST.IMG", 3);
        assertTrue("the pointer must lie past the end of the label file",
            lbl.length() < 2L * RECORD_BYTES);
        IIOImage image = read(lbl);
        assertPixels(image);
        Node vicar = embeddedVicarLabel(image);
        assertEquals("TESTMISSION", findItem(vicar, "MISSION_NAME").replace("'", ""));
    }

    /** NEW-pds3-1: ^IMAGE_HEADER at record 1 of the data file (Cassini ISS .lbl). */
    @Test
    public void headerPointerAtStartOfDataFileKeepsVicarLabel() throws Exception {
        writeDataFile("START.IMG", 0);
        IIOImage image = read(writeDetachedLabel("START.LBL", "START.IMG", 1));
        assertPixels(image);
        Node vicar = embeddedVicarLabel(image);
        assertEquals("TESTMISSION", findItem(vicar, "MISSION_NAME").replace("'", ""));
        assertEquals("TESTCAM", findItem(vicar, "INSTRUMENT_ID").replace("'", ""));
    }

    /** REVIEW-7: seeking past EOF is legal for an ImageInputStream; reads then return -1. */
    @Test
    public void fileChannelStreamSeekPastEndReadsEof() throws Exception {
        File f = new File(tempDir, "ten.bin");
        Files.write(f.toPath(), new byte[10]);
        try (RandomAccessFile raf = new RandomAccessFile(f, "r");
             FileChannelImageInputStream in = new FileChannelImageInputStream(raf.getChannel())) {
            in.seek(100);
            assertEquals(100, in.getStreamPosition());
            assertEquals(-1, in.read());
            assertEquals(-1, in.read(new byte[4], 0, 4));
            in.seek(4);
            assertEquals(0, in.read());
        }
    }
}
