package jpl.mipl.io.testsupport;

import java.io.File;

import jpl.mipl.io.vicar.test.TestGen;

/**
 * Writes the synthetic VICAR images used by the feature tests in tests/e2e,
 * replacing the VICAR `gen` program the legacy tstjConvertIIO.csh relied on.
 * Pixel value = line*LINC + sample*SINC + band*BINC (as in gen), written
 * with jpl.mipl.io.vicar.test.TestGen.
 * <p>
 * Usage: java -cp FAT.jar:target/test-classes jpl.mipl.io.testsupport.SyntheticGen outdir
 * <p>
 * Produces gen_&lt;type&gt;_&lt;org&gt;.vic for every data type x organization
 * (64 lines x 48 samples x 3 bands), plus the legacy shape cases
 * gen_real_100x100.vic, gen_byte_ns1_nl1024.vic and gen_byte_ns1024_nl1.vic.
 */
public class SyntheticGen {

	static final String[] TYPES = {"byte", "half", "full", "real", "doub"};
	static final String[] ORGS = {"bsq", "bil", "bip"};

	public static void main(String[] args) throws Exception {
		if (args.length != 1) {
			System.err.println("Usage: SyntheticGen outdir");
			System.exit(1);
		}
		File dir = new File(args[0]);
		dir.mkdirs();
		for (String type : TYPES) {
			for (String org : ORGS) {
				gen(dir, "gen_" + type + "_" + org + ".vic", 64, 48, 3, type, org, 1, 3, 40);
			}
		}
		gen(dir, "gen_real_100x100.vic", 100, 100, 1, "real", "bsq", 0.5, 0.25, 0);
		gen(dir, "gen_byte_ns1_nl1024.vic", 1024, 1, 1, "byte", "bsq", 1, 1, 0);
		gen(dir, "gen_byte_ns1024_nl1.vic", 1, 1024, 1, "byte", "bsq", 1, 1, 0);
	}

	static void gen(File dir, String name, int nl, int ns, int nb, String type, String org,
			double linc, double sinc, double binc) throws Exception {
		new TestGen(new String[] {
			new File(dir, name).getPath(), "" + nl, "" + ns, "" + nb, type, org, "line",
			"" + linc, "" + sinc, "" + binc, "0", "0", "1"});
		System.out.println(name);
	}
}
