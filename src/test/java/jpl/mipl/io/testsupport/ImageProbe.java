package jpl.mipl.io.testsupport;

import java.awt.image.BufferedImage;
import java.awt.image.DataBuffer;
import java.awt.image.Raster;
import java.awt.image.RenderedImage;
import java.io.File;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.util.Iterator;
import java.util.Locale;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

/**
 * Format-independent test oracle used by the feature tests in tests/e2e.
 * Reads any image vicario (or the JDK / JAI ImageIO plugins) can decode and
 * prints one JSON object describing it:
 * <pre>
 * {"file":..., "format":..., "width":..., "height":..., "bands":...,
 *  "dataType":..., "pixelSha256":..., "min":..., "max":..., "mean":..., "std":...}
 * </pre>
 * pixelSha256 hashes the decoded samples (line, sample, band order; big-endian;
 * floats by their IEEE bits), so the same pixels written to VICAR, PDS, TIFF or
 * PNG give the same hash. With --png a contrast-stretched 8-bit preview is
 * written for the test report.
 * <p>
 * Usage: java -cp FAT.jar:target/test-classes jpl.mipl.io.testsupport.ImageProbe
 *        file [--png preview.png]
 * Exit 0 on success, 2 when no reader can decode the file.
 */
public class ImageProbe {

	public static void main(String[] args) throws Exception {
		if (args.length != 1 && args.length != 3) {
			System.err.println("Usage: ImageProbe file [--png preview.png]");
			System.exit(1);
		}
		File file = new File(args[0]);
		File preview = args.length == 3 ? new File(args[2]) : null;

		ImageInputStream iis = ImageIO.createImageInputStream(file);
		Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
		if (iis == null || !readers.hasNext()) {
			System.err.println("ImageProbe: no ImageIO reader for " + file);
			System.exit(2);
		}
		ImageReader reader = readers.next();
		reader.setInput(iis);
		RenderedImage image = reader.readAsRenderedImage(0, null);
		Raster raster = image instanceof BufferedImage
			? ((BufferedImage) image).getRaster() : image.getData();

		int w = raster.getWidth(), h = raster.getHeight(), nb = raster.getNumBands();
		int x0 = raster.getMinX(), y0 = raster.getMinY();
		int dataType = raster.getDataBuffer().getDataType();
		boolean isFloat = dataType == DataBuffer.TYPE_FLOAT;
		boolean isDouble = dataType == DataBuffer.TYPE_DOUBLE;

		MessageDigest sha = MessageDigest.getInstance("SHA-256");
		ByteBuffer buf = ByteBuffer.allocate(8 * w * nb);
		double min = Double.POSITIVE_INFINITY, max = Double.NEGATIVE_INFINITY;
		double sum = 0, sumSq = 0;
		long n = 0;
		for (int y = 0; y < h; y++) {
			buf.clear();
			for (int x = 0; x < w; x++) {
				for (int b = 0; b < nb; b++) {
					double v = raster.getSampleDouble(x0 + x, y0 + y, b);
					if (isDouble) buf.putLong(Double.doubleToLongBits(v));
					else if (isFloat) buf.putInt(Float.floatToIntBits((float) v));
					else buf.putInt(raster.getSample(x0 + x, y0 + y, b));
					if (!Double.isNaN(v)) {
						min = Math.min(min, v);
						max = Math.max(max, v);
						sum += v;
						sumSq += v * v;
						n++;
					}
				}
			}
			sha.update(buf.array(), 0, buf.position());
		}
		double mean = n > 0 ? sum / n : 0;
		double std = n > 0 ? Math.sqrt(Math.max(0, sumSq / n - mean * mean)) : 0;

		if (preview != null) {
			writePreview(raster, min, max, preview);
		}

		StringBuilder hex = new StringBuilder();
		for (byte b : sha.digest()) hex.append(String.format("%02x", b));
		System.out.println(String.format(Locale.ROOT,
			"{\"file\":\"%s\",\"format\":\"%s\",\"width\":%d,\"height\":%d,\"bands\":%d,"
			+ "\"dataType\":\"%s\",\"pixelSha256\":\"%s\",\"min\":%s,\"max\":%s,\"mean\":%s,\"std\":%s}",
			json(file.getName()), json(reader.getFormatName()), w, h, nb, typeName(dataType),
			hex, num(min), num(max), num(mean), num(std)));
		// some plugin readers (e.g. FITS) throw from dispose(); the probe result is already out
		try {
			reader.dispose();
			iis.close();
		} catch (Exception e) {
			System.err.println("ImageProbe: ignoring error on close: " + e);
		}
	}

	/**
	 * Linear stretch between the 1st and 99th percentiles to 0..255 (so a few hot
	 * pixels do not leave 12-bit mission images black); 1 band → gray,
	 * 3+ bands → RGB of the first three.
	 */
	static void writePreview(Raster raster, double min, double max, File out) throws Exception {
		int w = raster.getWidth(), h = raster.getHeight();
		int nb = raster.getNumBands() >= 3 ? 3 : 1;
		int step = Math.max(1, (int) Math.sqrt((double) w * h / 250000));
		double[] sample = new double[((w + step - 1) / step) * ((h + step - 1) / step) * nb];
		int n = 0;
		for (int y = 0; y < h; y += step) {
			for (int x = 0; x < w; x += step) {
				for (int b = 0; b < nb; b++) {
					double v = raster.getSampleDouble(raster.getMinX() + x, raster.getMinY() + y, b);
					if (!Double.isNaN(v)) sample[n++] = v;
				}
			}
		}
		java.util.Arrays.sort(sample, 0, n);
		if (n > 0 && sample[(int) (n * 0.99)] > sample[(int) (n * 0.01)]) {
			min = sample[(int) (n * 0.01)];
			max = sample[(int) (n * 0.99)];
		}
		double scale = max > min ? 255.0 / (max - min) : 0;
		BufferedImage img = new BufferedImage(w, h,
			nb == 3 ? BufferedImage.TYPE_INT_RGB : BufferedImage.TYPE_BYTE_GRAY);
		int[] px = new int[nb];
		for (int y = 0; y < h; y++) {
			for (int x = 0; x < w; x++) {
				for (int b = 0; b < nb; b++) {
					double v = raster.getSampleDouble(raster.getMinX() + x, raster.getMinY() + y, b);
					px[b] = Double.isNaN(v) ? 0 : (int) Math.max(0, Math.min(255, (v - min) * scale));
				}
				if (nb == 3) img.setRGB(x, y, (px[0] << 16) | (px[1] << 8) | px[2]);
				else img.getRaster().setSample(x, y, 0, px[0]);
			}
		}
		ImageIO.write(img, "png", out);
	}

	static String typeName(int t) {
		switch (t) {
			case DataBuffer.TYPE_BYTE: return "BYTE";
			case DataBuffer.TYPE_SHORT: return "SHORT";
			case DataBuffer.TYPE_USHORT: return "USHORT";
			case DataBuffer.TYPE_INT: return "INT";
			case DataBuffer.TYPE_FLOAT: return "FLOAT";
			case DataBuffer.TYPE_DOUBLE: return "DOUBLE";
			default: return "UNKNOWN";
		}
	}

	static String num(double v) {
		return Double.isFinite(v) ? String.format(Locale.ROOT, "%.6g", v) : "null";
	}

	static String json(String s) {
		return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
	}
}
