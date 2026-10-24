package jpl.mipl.io.streams;

import static org.junit.Assert.*;

import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;

import javax.imageio.stream.FileImageInputStream;
import javax.imageio.stream.ImageInputStream;

import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

import it.geosolutions.imageio.stream.input.FileImageInputStreamExtImpl;

/**
 * ImageInputStreamStride must decode little-endian samples correctly whatever
 * ImageInputStream it is given (REVIEW-1). imageio-ext's
 * FileImageInputStreamExtImpl, which ImageIO.createImageInputStream(File)
 * returns when imageio-ext is on the classpath, ignores the byte order in its
 * typed-array reads, so the stride must not use them.
 */
public class ImageInputStreamStrideTest {

	static File le;
	static File be;

	/** Writes shorts 1..4, ints 1..4, floats 1..4, doubles 1..4 in the given order. */
	static File sampleFile(ByteOrder order) throws IOException {
		ByteBuffer b = ByteBuffer.allocate(4 * (2 + 4 + 4 + 8)).order(order);
		for (int i = 1; i <= 4; i++) b.putShort((short) i);
		for (int i = 1; i <= 4; i++) b.putInt(i);
		for (int i = 1; i <= 4; i++) b.putFloat(i);
		for (int i = 1; i <= 4; i++) b.putDouble(i);
		File f = File.createTempFile("stride", ".bin");
		Files.write(f.toPath(), b.array());
		return f;
	}

	@BeforeClass
	public static void setUpBeforeClass() throws IOException {
		le = sampleFile(ByteOrder.LITTLE_ENDIAN);
		be = sampleFile(ByteOrder.BIG_ENDIAN);
	}

	@AfterClass
	public static void tearDownAfterClass() {
		le.delete();
		be.delete();
	}

	static void assertReads1to4(ImageInputStream iis, ByteOrder order, int strideOrder) throws IOException {
		iis.setByteOrder(order);
		ImageInputStreamStride s = new ImageInputStreamStride(iis, strideOrder);
		short[] sh = new short[4];
		int[] in = new int[4];
		float[] fl = new float[4];
		double[] db = new double[4];
		s.readShorts(sh, 0, 4, 1);
		s.readInts(in, 0, 4, 1);
		s.readFloats(fl, 0, 4, 1);
		s.readDoubles(db, 0, 4, 1);
		assertArrayEquals(new short[] { 1, 2, 3, 4 }, sh);
		assertArrayEquals(new int[] { 1, 2, 3, 4 }, in);
		assertArrayEquals(new float[] { 1, 2, 3, 4 }, fl, 0f);
		assertArrayEquals(new double[] { 1, 2, 3, 4 }, db, 0d);
	}

	/** Regression for REVIEW-1: the imageio-ext stream returned 256, 512, ... */
	@Test
	public void littleEndianThroughImageioExtStream() throws IOException {
		try (ImageInputStream iis = new FileImageInputStreamExtImpl(le)) {
			assertReads1to4(iis, ByteOrder.LITTLE_ENDIAN, ImageInputStreamStride.LOW_ORDER);
		}
	}

	@Test
	public void bigEndianThroughImageioExtStream() throws IOException {
		try (ImageInputStream iis = new FileImageInputStreamExtImpl(be)) {
			assertReads1to4(iis, ByteOrder.BIG_ENDIAN, ImageInputStreamStride.HIGH_ORDER);
		}
	}

	@Test
	public void littleEndianThroughJdkStream() throws IOException {
		try (ImageInputStream iis = new FileImageInputStream(le)) {
			assertReads1to4(iis, ByteOrder.LITTLE_ENDIAN, ImageInputStreamStride.LOW_ORDER);
		}
	}

	/** Stream order differs from file order: the stride must swap itself. */
	@Test
	public void littleEndianFileOnBigEndianStream() throws IOException {
		try (ImageInputStream iis = new FileImageInputStream(le)) {
			assertReads1to4(iis, ByteOrder.BIG_ENDIAN, ImageInputStreamStride.LOW_ORDER);
		}
	}

	/** The fast path stays on for streams that honour the byte order, and off for the imageio-ext one. */
	@Test
	public void directPathOnlyForStreamsThatHonourByteOrder() throws IOException {
		try (ImageInputStream jdk = new FileImageInputStream(le);
				ImageInputStream ext = new FileImageInputStreamExtImpl(le)) {
			assertTrue(ImageInputStreamStride.typedArrayIoHonoursByteOrder(jdk));
			assertFalse(ImageInputStreamStride.typedArrayIoHonoursByteOrder(ext));
		}
	}
}
