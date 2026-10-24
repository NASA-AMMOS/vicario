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

	/** Pads a label string with blanks to its LBLSIZE. */
	static InputStream label(String items, int lblsize) {
		StringBuilder sb = new StringBuilder("LBLSIZE=" + lblsize + "  " + items);
		while (sb.length() < lblsize) sb.append(' ');
		return new ByteArrayInputStream(sb.toString().getBytes());
	}

	/**
	 * REVIEW-2: a history task that lost its TASK keyword leaves DAT_TIM and
	 * USER in the system label. Reading keeps them in a history task named
	 * UNKNOWN instead of rejecting the label.
	 */
	@Test
	public void readKeepsOrphanedHistoryItemsInUnknownTask() throws Exception {
		VicarLabel l = new VicarLabel();
		l.readLabelChunk(label("FORMAT='HALF' NL=3 NS=4 BINC='1.0' DAT_TIM='Thu Oct 17 16:46:44 2019' "
				+ "IVAL='1.0' TASK='TASK' USER='even' DAT_TIM='Fri Oct 18 14:17:42 2019'", 256));
		assertEquals("HALF", l.getSystem().getItem("FORMAT").getString());
		assertEquals("1.0", l.getSystem().getItem("BINC").getString());
		assertNull(l.getSystem().getItem("DAT_TIM"));
		assertEquals(2, l.getHistory().getNumSets());
		VicarLabelSet orphan = l.getHistory().getSet(0);
		assertEquals(VicarLabel.ORPHAN_HISTORY_TASK, orphan.getName());
		assertEquals("Thu Oct 17 16:46:44 2019", orphan.getItem("DAT_TIM").getString());
		assertEquals("1.0", orphan.getItem("IVAL").getString());
		assertEquals("TASK", l.getHistory().getSet(1).getName());
		assertEquals("even", l.getHistory().getSet(1).getItem("USER").getString());
	}

	/** A USER item in a property set (before any TASK) also goes to the UNKNOWN task. */
	@Test
	public void readMovesUserOutOfPropertySet() throws Exception {
		VicarLabel l = new VicarLabel();
		l.readLabelChunk(label("NL=1 PROPERTY='GEOTIFF' NITF_NROWS='3' USER='vos' SINC='1.0'", 128));
		assertEquals(1, l.getProperty().getNumSets());
		assertNull(l.getProperty().getSet(0).getItem("USER"));
		assertEquals("vos", l.getHistory().getSet(0).getItem("USER").getString());
		assertEquals("1.0", l.getHistory().getSet(0).getItem("SINC").getString());
	}

	/** Building labels through the API stays strict (off-nominal). */
	@Test(expected = IllegalArgumentException.class)
	public void programmaticAddStillRejectsDatTimInSystemLabel() {
		new VicarLabelSet(VicarLabelSet.LABEL_SYSTEM).add(new VicarLabelItem("DAT_TIM", "now"));
	}

	@Test(expected = IllegalArgumentException.class)
	public void programmaticAddStillRejectsUserInPropertyLabel() {
		new VicarLabelSet(VicarLabelSet.LABEL_PROPERTY, "P").add(new VicarLabelItem("USER", "me"));
	}

}
