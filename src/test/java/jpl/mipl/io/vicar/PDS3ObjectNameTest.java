package jpl.mipl.io.vicar;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import jpl.mipl.io.plugins.PDSImageReadParam;

/**
 * Regression coverage for IDS-10212: PDS3 reader must support labels whose
 * image OBJECT is not literally named "IMAGE" (e.g. Moon Mineralogy Mapper's
 * "RFL_IMAGE"). Each test synthesizes a minimal attached PDS3 file in a temp
 * directory and reads it via PDSInputFile.
 */
public class PDS3ObjectNameTest {

    private static final int RECORD_BYTES = 1024;
    private static final int LINES = 4;
    private static final int LINE_SAMPLES = 4;

    private File tempDir;

    @Before
    public void setUp() throws Exception {
        tempDir = Files.createTempDirectory("pds3-objname-test").toFile();
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

    /** Build a minimal attached PDS3 file with a single image-shaped OBJECT. */
    private File writePdsFile(String objectName) throws Exception {
        StringBuilder lbl = new StringBuilder();
        lbl.append("PDS_VERSION_ID                  = PDS3\r\n");
        lbl.append("RECORD_TYPE                     = FIXED_LENGTH\r\n");
        lbl.append("RECORD_BYTES                    = ").append(RECORD_BYTES).append("\r\n");
        lbl.append("FILE_RECORDS                    = 2\r\n");
        lbl.append("LABEL_RECORDS                   = 1\r\n");
        lbl.append("\r\n");
        lbl.append("^").append(objectName).append("                = 2\r\n");
        lbl.append("\r\n");
        lbl.append("OBJECT                          = ").append(objectName).append("\r\n");
        lbl.append("  LINES                         = ").append(LINES).append("\r\n");
        lbl.append("  LINE_SAMPLES                  = ").append(LINE_SAMPLES).append("\r\n");
        lbl.append("  BANDS                         = 1\r\n");
        lbl.append("  SAMPLE_BITS                   = 8\r\n");
        lbl.append("  SAMPLE_TYPE                   = UNSIGNED_INTEGER\r\n");
        lbl.append("  BAND_STORAGE_TYPE             = BAND_SEQUENTIAL\r\n");
        lbl.append("END_OBJECT                      = ").append(objectName).append("\r\n");
        lbl.append("\r\n");
        lbl.append("END\r\n");
        return writeAttachedPdsFile(objectName + ".PDS", lbl.toString());
    }

    /** Build a label with no image-shaped OBJECT at all (only a HISTORY block). */
    private File writePdsFileNoImage() throws Exception {
        StringBuilder lbl = new StringBuilder();
        lbl.append("PDS_VERSION_ID                  = PDS3\r\n");
        lbl.append("RECORD_TYPE                     = FIXED_LENGTH\r\n");
        lbl.append("RECORD_BYTES                    = ").append(RECORD_BYTES).append("\r\n");
        lbl.append("FILE_RECORDS                    = 2\r\n");
        lbl.append("LABEL_RECORDS                   = 1\r\n");
        lbl.append("\r\n");
        lbl.append("OBJECT                          = HISTORY\r\n");
        lbl.append("  HISTORY_TYPE                  = PDS_HISTORY\r\n");
        lbl.append("END_OBJECT                      = HISTORY\r\n");
        lbl.append("\r\n");
        lbl.append("END\r\n");
        return writeAttachedPdsFile("NO_IMAGE.PDS", lbl.toString());
    }

    private File writeAttachedPdsFile(String name, String labelText) throws Exception {
        byte[] labelBytes = labelText.getBytes(StandardCharsets.US_ASCII);
        if (labelBytes.length > RECORD_BYTES) {
            throw new IllegalStateException("Synthesized label exceeds RECORD_BYTES: "
                + labelBytes.length + " > " + RECORD_BYTES);
        }
        byte[] padding = new byte[RECORD_BYTES - labelBytes.length];
        Arrays.fill(padding, (byte) ' ');

        byte[] imageData = new byte[LINES * LINE_SAMPLES];
        for (int i = 0; i < imageData.length; i++) imageData[i] = (byte) i;

        File f = new File(tempDir, name);
        try (FileOutputStream fos = new FileOutputStream(f);
             ByteArrayOutputStream buf = new ByteArrayOutputStream()) {
            buf.write(labelBytes);
            buf.write(padding);
            buf.write(imageData);
            fos.write(buf.toByteArray());
        }
        return f;
    }

    private SystemLabel openWithParam(File f, PDSImageReadParam param) throws Exception {
        PDSInputFile pif = new PDSInputFile(param);
        pif.open(f.getAbsolutePath());
        return pif.getSystemLabel();
    }

    @Test
    public void readsStandardImageObject() throws Exception {
        File f = writePdsFile("IMAGE");
        SystemLabel sys = openWithParam(f, new PDSImageReadParam());
        assertNotNull("SystemLabel should be populated for OBJECT = IMAGE", sys);
        assertEquals(LINES, sys.getNL());
        assertEquals(LINE_SAMPLES, sys.getNS());
        assertEquals(1, sys.getNB());
    }

    @Test
    public void readsRflImageWithExplicitParam() throws Exception {
        File f = writePdsFile("RFL_IMAGE");
        PDSImageReadParam param = new PDSImageReadParam();
        param.setPdsObjectName("RFL_IMAGE");
        SystemLabel sys = openWithParam(f, param);
        assertNotNull("Explicit PDS_OBJECT=RFL_IMAGE should resolve", sys);
        assertEquals(LINES, sys.getNL());
        assertEquals(LINE_SAMPLES, sys.getNS());
        assertEquals(1, sys.getNB());
    }

    @Test
    public void readsRflImageViaHeuristicWhenParamUnset() throws Exception {
        File f = writePdsFile("RFL_IMAGE");
        SystemLabel sys = openWithParam(f, new PDSImageReadParam());
        assertNotNull("Heuristic should locate the image-shaped OBJECT", sys);
        assertEquals(LINES, sys.getNL());
        assertEquals(LINE_SAMPLES, sys.getNS());
        assertEquals(1, sys.getNB());
    }

    @Test
    public void noImageObjectProducesEmptySystemLabel() throws Exception {
        File f = writePdsFileNoImage();
        SystemLabel sys = openWithParam(f, new PDSImageReadParam());
        // A label with no image OBJECT either yields a null SystemLabel (no
        // PDS_LABEL root) or one whose NL/NS are 0. Either way we must not
        // throw and the user-visible state must show "no image data" rather
        // than partially-populated nonsense.
        if (sys != null) {
            assertEquals(0, sys.getNL());
            assertEquals(0, sys.getNS());
        } else {
            assertNull(sys);
        }
    }
}
