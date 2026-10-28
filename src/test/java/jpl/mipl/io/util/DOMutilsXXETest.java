package jpl.mipl.io.util;

import static org.junit.Assert.*;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileWriter;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.stream.StreamSource;

import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.w3c.dom.Document;

/**
 * Verifies that DOMutils parses XML with XML External Entity (XXE)
 * protection, for both the JDK built-in parser (used at runtime) and
 * Apache Xerces (on the test classpath), and reads XSL stylesheets with the
 * same protection for both the JDK transformer and Xalan.
 */
public class DOMutilsXXETest {

	static final String FACTORY_PROPERTY = "javax.xml.parsers.DocumentBuilderFactory";
	static final String[] FACTORY_IMPLS = {
		"com.sun.org.apache.xerces.internal.jaxp.DocumentBuilderFactoryImpl",
		"org.apache.xerces.jaxp.DocumentBuilderFactoryImpl"
	};
	static final String TRANSFORMER_PROPERTY = "javax.xml.transform.TransformerFactory";
	static final String[] TRANSFORMER_IMPLS = {
		"com.sun.org.apache.xalan.internal.xsltc.trax.TransformerFactoryImpl",
		"org.apache.xalan.processor.TransformerFactoryImpl"
	};
	static final String SECRET = "XXE-SECRET-CONTENT";

	@Rule
	public TemporaryFolder tmp = new TemporaryFolder();

	String savedFactory;
	String savedTransformer;
	File secretFile;

	@Before
	public void setUp() throws Exception {
		savedFactory = System.getProperty(FACTORY_PROPERTY);
		savedTransformer = System.getProperty(TRANSFORMER_PROPERTY);
		secretFile = tmp.newFile("secret.txt");
		try (FileWriter w = new FileWriter(secretFile)) {
			w.write(SECRET);
		}
	}

	@After
	public void tearDown() {
		if (savedFactory == null) {
			System.clearProperty(FACTORY_PROPERTY);
		} else {
			System.setProperty(FACTORY_PROPERTY, savedFactory);
		}
		if (savedTransformer == null) {
			System.clearProperty(TRANSFORMER_PROPERTY);
		} else {
			System.setProperty(TRANSFORMER_PROPERTY, savedTransformer);
		}
	}

	/** Transform a one-element document with the stylesheet in xsl. */
	Document transformWith(String xsl) throws Exception {
		File xslFile = tmp.newFile();
		try (FileWriter w = new FileWriter(xslFile)) {
			w.write(xsl);
		}
		DOMutils d = new DOMutils();
		Document in = d.buildDocument(stream("<label/>"));
		return d.transformDocument(in, new StreamSource(xslFile), null);
	}

	static InputStream stream(String xml) {
		return new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8));
	}

	static String text(Document doc) {
		return doc == null ? "" : doc.getDocumentElement().getTextContent();
	}

	@Test
	public void factoryHasXXEFeaturesDisabled() throws Exception {
		for (String impl : FACTORY_IMPLS) {
			System.setProperty(FACTORY_PROPERTY, impl);
			DocumentBuilderFactory f = DOMutils.newDocumentBuilderFactory();
			assertEquals(impl, f.getClass().getName());
			assertFalse(impl, f.getFeature("http://xml.org/sax/features/external-general-entities"));
			assertFalse(impl, f.getFeature("http://xml.org/sax/features/external-parameter-entities"));
			assertFalse(impl, f.getFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd"));
			assertFalse(impl, f.isXIncludeAware());
		}
	}

	@Test
	public void externalGeneralEntityIsNotResolved() throws Exception {
		String xml = "<?xml version=\"1.0\"?>\n"
			+ "<!DOCTYPE label [ <!ENTITY xxe SYSTEM \"" + secretFile.toURI() + "\"> ]>\n"
			+ "<label>&xxe;</label>";
		for (String impl : FACTORY_IMPLS) {
			System.setProperty(FACTORY_PROPERTY, impl);
			Document doc = new DOMutils().buildDocument(stream(xml));
			assertFalse(impl + " resolved an external entity", text(doc).contains(SECRET));
		}
	}

	@Test
	public void externalParameterEntityIsNotResolved() throws Exception {
		File dtd = tmp.newFile("evil.dtd");
		try (FileWriter w = new FileWriter(dtd)) {
			w.write("<!ENTITY leak SYSTEM \"" + secretFile.toURI() + "\">");
		}
		String xml = "<?xml version=\"1.0\"?>\n"
			+ "<!DOCTYPE label [ <!ENTITY % ext SYSTEM \"" + dtd.toURI() + "\"> %ext; ]>\n"
			+ "<label>&leak;</label>";
		for (String impl : FACTORY_IMPLS) {
			System.setProperty(FACTORY_PROPERTY, impl);
			Document doc = new DOMutils().buildDocument(stream(xml));
			assertFalse(impl + " resolved a parameter entity", text(doc).contains(SECRET));
		}
	}

	@Test
	public void externalDtdIsNotLoaded() throws Exception {
		// Labels written by this library reference a DTD that is not shipped;
		// they must still parse, and the DTD must never be fetched.
		String xml = "<?xml version=\"1.0\"?>\n"
			+ "<!DOCTYPE PDS_LABEL SYSTEM \"" + new File(tmp.getRoot(), "missing.dtd").toURI() + "\">\n"
			+ "<PDS_LABEL><item key=\"LINES\">10</item></PDS_LABEL>";
		for (String impl : FACTORY_IMPLS) {
			System.setProperty(FACTORY_PROPERTY, impl);
			Document doc = new DOMutils().buildDocument(stream(xml));
			assertNotNull(impl + " failed to parse a label with a DOCTYPE", doc);
			assertEquals(impl, "PDS_LABEL", doc.getDocumentElement().getNodeName());
		}
	}

	@Test
	public void namespacedLabelStillParses() throws Exception {
		String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
			+ "<?xml-model href=\"https://pds.nasa.gov/pds4/pds/v1/PDS4_PDS_1F00.sch\"?>\n"
			+ "<Product_Observational xmlns=\"http://pds.nasa.gov/pds4/pds/v1\">"
			+ "<Identification_Area><title>test</title></Identification_Area>"
			+ "</Product_Observational>";
		for (String impl : FACTORY_IMPLS) {
			System.setProperty(FACTORY_PROPERTY, impl);
			Document doc = new DOMutils().buildDocument(stream(xml));
			assertNotNull(impl, doc);
			assertEquals(impl, "http://pds.nasa.gov/pds4/pds/v1",
				doc.getDocumentElement().getNamespaceURI());
			assertEquals(impl, "test", text(doc));
		}
	}

	@Test
	public void stylesheetExternalEntityIsNotResolved() throws Exception {
		String xsl = "<?xml version=\"1.0\"?>\n"
			+ "<!DOCTYPE xsl:stylesheet [ <!ENTITY xxe SYSTEM \"" + secretFile.toURI() + "\"> ]>\n"
			+ "<xsl:stylesheet version=\"1.0\" xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\">"
			+ "<xsl:template match=\"/\"><out>&xxe;</out></xsl:template>"
			+ "</xsl:stylesheet>";
		for (String impl : TRANSFORMER_IMPLS) {
			System.setProperty(TRANSFORMER_PROPERTY, impl);
			assertEquals(impl, DOMutils.newTransformerFactory().getClass().getName());
			Document doc = transformWith(xsl);
			assertFalse(impl + " resolved an external entity in a stylesheet", text(doc).contains(SECRET));
		}
	}

	@Test
	public void stylesheetStillTransforms() throws Exception {
		String xsl = "<?xml version=\"1.0\"?>\n"
			+ "<xsl:stylesheet version=\"1.0\" xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\">"
			+ "<xsl:template match=\"/\"><out>transformed</out></xsl:template>"
			+ "</xsl:stylesheet>";
		for (String impl : TRANSFORMER_IMPLS) {
			System.setProperty(TRANSFORMER_PROPERTY, impl);
			Document doc = transformWith(xsl);
			assertNotNull(impl + " failed to transform", doc);
			assertEquals(impl, "transformed", text(doc));
		}
	}
}
