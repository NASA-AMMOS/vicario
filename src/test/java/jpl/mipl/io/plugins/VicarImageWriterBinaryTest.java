package jpl.mipl.io.plugins;

import static org.junit.Assert.*;

import java.awt.image.BufferedImage;
import java.awt.image.WritableRaster;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.imageio.IIOImage;
import javax.imageio.ImageWriteParam;
import javax.imageio.stream.MemoryCacheImageOutputStream;

import org.junit.Test;

import jpl.mipl.io.vicar.VicarBinaryHeader;
import jpl.mipl.io.vicar.VicarBinaryLinePrefix;

/**
 * VicarImageWriter carries binary line prefixes (NBB) and the binary header
 * (NLB) from the metadata into the output when the PDSImageWriteParam asks
 * for them (REVIEW-13: they used to be dropped).
 */
public class VicarImageWriterBinaryTest {

	static final int NS = 8, NL = 4, NBB = 4;

	/** An 8 x 4 BYTE image with pixel value 10*line + sample. */
	static BufferedImage image(int nl) {
		BufferedImage bi = new BufferedImage(NS, nl, BufferedImage.TYPE_BYTE_GRAY);
		WritableRaster r = bi.getRaster();
		for (int y = 0; y < nl; y++)
			for (int x = 0; x < NS; x++)
				r.setSample(x, y, 0, 10 * y + x);
		return bi;
	}

	/** Prefix bytes of line l: (100+l, 101+l, ...). */
	static byte[] prefix(int line) {
		byte[] b = new byte[NBB];
		for (int i = 0; i < NBB; i++) b[i] = (byte) (100 + line + i);
		return b;
	}

	static VicarMetadata metadata(int prefixLines, byte[] header) {
		VicarMetadata vm = new VicarMetadata();
		VicarBinaryLinePrefix vbp = new VicarBinaryLinePrefix(1, prefixLines, NBB);
		for (int l = 0; l < prefixLines; l++) vbp.setPrefix(0, l, prefix(l));
		vbp.set_bltype("TEST-TYPE");
		vm.setVicarBinaryLinePrefix(vbp);
		if (header != null) {
			// input RECSIZE: NBB + NS
			VicarBinaryHeader vbh = new VicarBinaryHeader(NBB + NS, 1, header);
			vbh.set_bltype("TEST-TYPE");
			vm.setVicarBinaryHeader(vbh);
		}
		return vm;
	}

	static byte[] write(BufferedImage bi, VicarMetadata vm, ImageWriteParam param) throws IOException {
		ByteArrayOutputStream bos = new ByteArrayOutputStream();
		VicarImageWriter w = new VicarImageWriter(null);
		try (MemoryCacheImageOutputStream ios = new MemoryCacheImageOutputStream(bos)) {
			w.setOutput(ios);
			if (param == null)
				w.write(new IIOImage(bi, null, vm));
			else
				w.write(null, new IIOImage(bi, null, vm), param);
		}
		return bos.toByteArray();
	}

	static PDSImageWriteParam param(boolean prefix, boolean header) {
		PDSImageWriteParam p = new PDSImageWriteParam();
		p.setAddLinePrefix(prefix);
		p.setAddBinaryHeader(header);
		return p;
	}

	static Map<String, String> label(byte[] file) {
		String head = new String(file, 0, Math.min(file.length, 4096), StandardCharsets.ISO_8859_1);
		Matcher m = Pattern.compile("([A-Z0-9_]+)=\\s*('[^']*'|\\S+)").matcher(head);
		Map<String, String> l = new HashMap<>();
		while (m.find()) l.putIfAbsent(m.group(1), m.group(2).replace("'", ""));
		return l;
	}

	static int num(Map<String, String> l, String k) {
		return Integer.parseInt(l.get(k));
	}

	/** Checks pixels (and prefixes if nbb > 0) of every image record. */
	static void assertImage(byte[] f, Map<String, String> l, int nl, boolean prefixes) {
		int lbl = num(l, "LBLSIZE"), rec = num(l, "RECSIZE"), nlb = num(l, "NLB"), nbb = num(l, "NBB");
		assertEquals(prefixes ? NBB : 0, nbb);
		assertEquals(nbb + NS, rec);
		for (int y = 0; y < nl; y++) {
			int start = lbl + (nlb + y) * rec;
			if (prefixes)
				assertArrayEquals("prefix of line " + y, prefix(y), Arrays.copyOfRange(f, start, start + NBB));
			for (int x = 0; x < NS; x++)
				assertEquals("pixel " + x + "," + y, 10 * y + x, f[start + nbb + x]);
		}
	}

	static byte[] header(int nonZeroBytes) {
		byte[] h = new byte[NBB + NS];
		for (int i = 0; i < nonZeroBytes; i++) h[i] = (byte) (200 + i);
		return h;
	}

	@Test
	public void keepsPrefixesAndHeader() throws IOException {
		byte[] h = header(NBB + NS);
		byte[] f = write(image(NL), metadata(NL, h), param(true, true));
		Map<String, String> l = label(f);
		assertEquals(1, num(l, "NLB"));
		assertEquals("TEST-TYPE", l.get("BLTYPE"));
		assertImage(f, l, NL, true);
		int lbl = num(l, "LBLSIZE");
		assertArrayEquals(h, Arrays.copyOfRange(f, lbl, lbl + h.length));
	}

	@Test
	public void keepsPrefixesOnly() throws IOException {
		byte[] f = write(image(NL), metadata(NL, header(3)), param(true, false));
		Map<String, String> l = label(f);
		assertEquals(0, num(l, "NLB"));
		assertImage(f, l, NL, true);
	}

	/** Header records shrink from 12 to 8 bytes; only zero bytes are cut. */
	@Test
	public void headerWithoutPrefixesTruncatesZeroTail() throws IOException {
		byte[] h = header(5);
		byte[] f = write(image(NL), metadata(NL, h), param(false, true));
		Map<String, String> l = label(f);
		assertEquals(1, num(l, "NLB"));
		assertImage(f, l, NL, false);
		int lbl = num(l, "LBLSIZE");
		assertArrayEquals(Arrays.copyOf(h, NS), Arrays.copyOfRange(f, lbl, lbl + NS));
	}

	/** Header records shrink from 12 to 8 bytes and would lose data: re-blocked into 2 records. */
	@Test
	public void headerWithoutPrefixesReblocksWhenDataWouldBeCut() throws IOException {
		byte[] h = header(NBB + NS);
		byte[] f = write(image(NL), metadata(NL, h), param(false, true));
		Map<String, String> l = label(f);
		assertEquals(2, num(l, "NLB"));
		assertImage(f, l, NL, false);
		int lbl = num(l, "LBLSIZE");
		assertArrayEquals(h, Arrays.copyOfRange(f, lbl, lbl + h.length));
		assertArrayEquals(new byte[2 * NS - h.length], Arrays.copyOfRange(f, lbl + h.length, lbl + 2 * NS));
	}

	/** Off-nominal: the image has fewer lines than the prefixes describe, so they are not written. */
	@Test
	public void dropsPrefixesWhenLineCountChanged() throws IOException {
		byte[] f = write(image(NL - 1), metadata(NL, null), param(true, true));
		Map<String, String> l = label(f);
		assertEquals(0, num(l, "NLB"));
		assertImage(f, l, NL - 1, false);
	}

	/** Off-nominal: without a PDSImageWriteParam nothing binary is written (unchanged API behaviour). */
	@Test
	public void noParamWritesNoBinaryData() throws IOException {
		byte[] f = write(image(NL), metadata(NL, header(5)), null);
		Map<String, String> l = label(f);
		assertEquals(0, num(l, "NLB"));
		assertImage(f, l, NL, false);
	}
}
