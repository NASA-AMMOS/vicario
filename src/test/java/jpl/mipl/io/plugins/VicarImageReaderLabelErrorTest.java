package jpl.mipl.io.plugins;

import static org.junit.Assert.*;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import javax.imageio.IIOException;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;

import org.junit.Test;

/**
 * NEW-vicar-1: a VICAR label the parser rejects used to be swallowed by
 * VicarImageReader.readHeader, which left the reader half set up and failed
 * later with a NullPointerException. It must fail with an IIOException that
 * names the label problem.
 */
public class VicarImageReaderLabelErrorTest {

	/** A 4 x 2 BYTE image whose label ends with a keyword that has no value. */
	static ImageInputStream badLabel() {
		StringBuilder sb = new StringBuilder("LBLSIZE=200             FORMAT='BYTE'  TYPE='IMAGE'  RECSIZE=4 "
				+ "ORG='BSQ' NL=2 NS=4 NB=1 NBB=0 NLB=0 INTFMT='LOW' REALFMT='RIEEE' TASK=");
		while (sb.length() < 200) sb.append(' ');
		byte[] label = sb.toString().getBytes(StandardCharsets.ISO_8859_1);
		byte[] file = new byte[label.length + 8];
		System.arraycopy(label, 0, file, 0, label.length);
		return new MemoryCacheImageInputStream(new ByteArrayInputStream(file));
	}

	@Test
	public void malformedLabelFailsWithIIOException() throws Exception {
		VicarImageReader reader = new VicarImageReader(new VicarImageReaderSpi());
		reader.setInput(badLabel());
		try {
			reader.read(0);
			fail("expected an IIOException for the malformed label");
		} catch (IIOException e) {
			assertTrue(e.getMessage(), e.getMessage().contains("Error reading VICAR label"));
			assertTrue(e.getMessage(), e.getMessage().contains("TASK"));
		}
	}

	@Test
	public void malformedLabelFailsWithIIOExceptionForWidth() throws Exception {
		VicarImageReader reader = new VicarImageReader(new VicarImageReaderSpi());
		reader.setInput(badLabel());
		try {
			reader.getWidth(0);
			fail("expected an IIOException for the malformed label");
		} catch (IIOException e) {
			assertTrue(e.getMessage(), e.getMessage().contains("Error reading VICAR label"));
		}
	}
}
