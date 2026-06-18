package jpl.mipl.io.vicar;

import static org.junit.Assert.*;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;

import org.junit.After;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

public class VicarLabelTest {
	
	static String testInputString;
	static InputStream tis;
	static VicarLabel vl;

	@BeforeClass
	public static void setUpBeforeClass() throws Exception {
		testInputString = "TTEEEEEESSSSSST!";
		vl = new VicarLabel();
	}

	@AfterClass
	public static void tearDownAfterClass() throws Exception {
		testInputString = null;
		vl = null;
	}

	@Before
	public void setUp() throws Exception {
		tis = new ByteArrayInputStream( testInputString.getBytes() );
	}

	@After
	public void tearDown() throws Exception {
		try {
			tis.close();
		} finally {
		    tis = null;
		}
	}

	@Test(expected = VicarLabelSyntaxException.class)
	public void test() throws Exception {
		vl.readLabelChunk(tis);
	}

}
