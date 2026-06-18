/*
 * Pds4NamespaceContext.java
 * 
 * Used by xpath to describe the namespace used by a document
 * XPATH  expressions will fail if the namespace context is not set and the document has 
 * ELEMENTS with namespaces used.
 * This one is currently hardcodes to make things work.
 * There should be another Class which has no default namespaces.
 * They will all be set using public void setPrefixAndNamespace(String prefix, String namespace) 
 * The namespace info will need to be pulled out of the xml String before it is parsed
 * Apparently the parser does not bring in the namespace info
 * 
 * Steve Levoe NASA/JPL/MIPL 01/2014
 */



package jpl.mipl.io.util;

// import gov.nasa.pds.imaging.generate.Generator;

import javax.xml.XMLConstants;
import javax.xml.namespace.NamespaceContext;
import javax.xml.transform.stream.StreamSource;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.StringReader;
import java.io.InputStreamReader;

import java.io.FileNotFoundException;
import java.io.IOException;

import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
// import java.xml.xpath.XPathConstants;

public class Pds4NamespaceContext implements NamespaceContext {
	
	
	// new constructor which takes in a filename
	// prefix is the key, namespace is the value
	HashMap<String, String> namespaceMap = new HashMap();
	
	// namespace is the key, prefix is the value
	HashMap<String, String> prefixMap = new HashMap();
						//   "pds4_namespaces.txt"
	String PDS4_NAMESPACES = "pds4_namespaces.txt";
	String PDS4_NAMESPACES_FULLPATH = "jpl/mipl/io/util/pds4_namespaces.txt";
	String filename = "";
	
	// boolean debug = true;
	boolean debug = false;
	boolean initialized = false;
	
	// constructor which takes in an array of Strings which contain key value pairs
	public Pds4NamespaceContext() {
		super();
		// this should force using the file in the jar
		setPrefixAndNamespaceFromFile(null);	
	}
	
	public Pds4NamespaceContext(String fname) {
		
		filename = fname;
		setPrefixAndNamespaceFromFile(fname);
		
		
	}
	
	 public Pds4NamespaceContext(InputStream is) {
			
	    	// super() ; // ???
			// filename = fname;
		
	    	setPrefixAndNamespaceFromXMLInputStream(is);
				
		}

	
	public String getNamespaceURI(String prefix)
    {
	
		if (initialized == false) {
    		setPrefixAndNamespaceFromFile(filename);
    	}
		String namespace = XMLConstants.NULL_NS_URI;
		
    	
    	if (prefixMap.containsKey(prefix)) {
    		namespace = prefixMap.get(prefix);
    	}
		
    	if (debug) System.out.println("Pds4NamespaceContext.getNamespaceURI("+prefix+") = "+namespace+" ");
		return namespace;
    }
    
    public String getPrefix(String namespace)
    {
    	if (initialized == false) {
    		setPrefixAndNamespaceFromFile(filename);
    	}
    	String prefix = null;
    	
    	if (namespaceMap.containsKey(namespace)) {
    		prefix = namespaceMap.get(namespace);
    	}
    	
    	if (debug) System.out.println("Pds4NamespaceContext.getPrefix("+namespace+") = "+prefix+" ");
		return prefix;
    }
    
	

    public Iterator getPrefixes(String namespace)
    {
        return null;
    }
    
    public void setPrefixAndNamespace(String prefix, String namespace) {
    	// add these to the namespace
    	// we need a MAP or something to store things in
    	// this is for the future. for now use statically initialized data
    	
    }
    
    public void setPrefixAndNamespaceFromXMLInputStream(InputStream is) {
        
    	if (debug) System.out.println("Pds4NamespaceContext.setPrefixAndNamespaceFromXMLInputStream >"+is+"< ");
    	BufferedReader bfReader;
    	List<String> list = new ArrayList();
    	int lineNo = 0;
    	int kvAddCt  = 0;
    	if (is == null) return; // throw an exception or print something??
    	try {
            bfReader = new BufferedReader(new InputStreamReader(is));
            String line = null;
            String kv = "";
            while((line = bfReader.readLine()) != null){
            	lineNo += 1;
            	// if (debug) System.out.printf("%s) %s \n", lineNo,line);
            	
            	// search for lines that contain xmlns:
            	if (line.length() > 0 && line.contains("xmlns:")) {
            		// get just the xmlns: part, then filter out the xmlns:
            		
            		String[] words = line.split("\\s+");
            		
            		for (int i = 0; i < words.length; i++) {
            			kv = words[i];
            			if (debug) System.out.printf("%d/%d) kv %s @@@@@@@@@@@@@@@@@@@@@@@@@@ \n", lineNo,i,kv);
            			if (kv.contains("xmlns:")) { 
            				if (debug) System.out.printf("%d/%d) contains xmlns  %s &&&&&&&&&&&&&&&&&&&&&&&&&&&\n", lineNo,i, kv);
            				// eliminate whitespace
            				kv = kv.replaceAll(" ","");
            				// replace any quotes
            				kv = kv.replaceAll("\"","");
                    		kv = kv.replace("xmlns:", "");
                    		
            				kvAddCt += 1;
            				if (debug) System.out.printf("%d/%d/%d) list.add %s #####################################\n", lineNo,i, kvAddCt,  kv);
                    		list.add(kv);
            			}
            		}            		
            	}
            	
            	// 
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    	
    	// if (true) return;
    	
    	String[] key_value = list.toArray(new String[0]);
    	if (debug) System.out.printf("key_value "+key_value);
    	
    	setPrefixAndNamespaceFromStringArray(key_value) ;
    	
    }

    
    public void setPrefixAndNamespaceFromFile(String filename) {
    	// open the file, loop thru the values and add 
    	// add these to the namespace
    	// we need a MAP or something to store things in
    	// this is for the future. for now use statically initialized data
        // open the file, read into a String[] key_value
    	// if file can't be opened use these defaults
    	InputStream is = null;
    	FileInputStream fis;
    	BufferedReader br = null;
    	if (debug) System.out.println("Pds4NamespaceContext.setPrefixAndNamespaceFromFile >"+filename+"< ");
    	if (filename == null || filename.equals("")) {
    		
    		/****
    		System.out.println(" from jar: "+PDS4_NAMESPACES);
    		is = Pds4NamespaceContext.class.getResourceAsStream(PDS4_NAMESPACES);
    		System.out.println(" x1 Pds4NamespaceContext is "+is);
    		
    		is = Pds4NamespaceContext.class.getClassLoader().getResourceAsStream(PDS4_NAMESPACES);
    		System.out.println(" x2 Pds4NamespaceContext is "+is);
    		
    		if (is == null) {
    			System.out.println(" from jar: "+PDS4_NAMESPACES_FULLPATH);
    			is = Pds4NamespaceContext.class.getResourceAsStream(PDS4_NAMESPACES_FULLPATH);
    		}
    		
    		System.out.println(" x3 Pds4NamespaceContext is "+is);
    		****/
    		if (debug) System.out.println(" from jar: "+PDS4_NAMESPACES_FULLPATH);
    		is = Pds4NamespaceContext.class.getClassLoader().getResourceAsStream(PDS4_NAMESPACES_FULLPATH);
    		if (debug) System.out.println(" x4 Pds4NamespaceContext is "+is);
    		// fr = new BufferedReader(Pds4NamespaceContext.class.getResourceAsStream(PDS4_NAMESPACES));
    	} else {
    		if (debug) System.out.println(" From File >"+filename+"< ");
    		try {
    			is = new FileInputStream(filename);
    		} catch (FileNotFoundException fnfe) {
    			if (debug) System.out.println("Pds4NamespaceContext "+fnfe);
    			fnfe.printStackTrace();
    		}
    	}	
    	
    	if (debug) System.out.println("Pds4NamespaceContext is "+is);
    	if (is != null) {
    		br = new BufferedReader(new InputStreamReader(is));
    	}
    	/***
    	String[] key_value = {"# prefix = namespace",
    			"pds = http://pds.nasa.gov/pds4/pds/v1", 
    			"dph = http://pds.nasa.gov/pds4/dph/v01", 
    			"xsi = http://www.w3.org/2001/XMLSchema-instance" };
    			***/
    	String sCurrentLine;
    	List<String> list = new ArrayList();
    	if (br != null) {
    		if (debug) System.out.println("Pds4NamespaceContext read from file");
    		// allocate an array to store the strings
    		// make a List, then dump to array ??
    		try {
    			while ((sCurrentLine = br.readLine()) != null) {
    				if (debug) System.out.println(sCurrentLine);
    				list.add(sCurrentLine);
    			}
    		} catch (IOException ioe) {
    			if (debug) System.out.println("Pds4NamespaceContext "+ioe);
    			ioe.printStackTrace();
    		}
    	} else {
    		if (debug) System.out.println("Pds4NamespaceContext setting defaults");
    		// add some default va;ues
    		list.add("# prefix = namespace");
    		list.add("pds = http://pds.nasa.gov/pds4/pds/v1");
    		list.add("dph = http://pds.nasa.gov/pds4/dph/v01"); 
    		list.add("xsi = http://www.w3.org/2001/XMLSchema-instance");
    	}
    	
    	String[] key_value = list.toArray(new String[0]);
    	
    	setPrefixAndNamespaceFromStringArray(key_value) ;
    	
    }
    
    public void setPrefixAndNamespaceFromStringArray(String[] key_value) {
    	// open the file, loop thru the values and add 
    	// add these to the namespace
    	// we need a MAP or something to store things in
    	// this is for the future. for now use statically initialized data
    	String kv;
    	for (int i=0; i<key_value.length ; i++) {
    		kv = key_value[i];
    		// remove all whitespace 
    		kv = kv.replaceAll(" ","");
    		// ignore empty line, lines with start with #, line must have an "=" so we can split
    		if (kv.length() > 0 && kv.contains("=") && !kv.startsWith("#")) {
    			String[] kva = kv.split("=");
    		
    			String prefix = kva[0];
    			String namespace = kva[1];
    			prefix = prefix.replaceAll(" ","");
    			namespace = namespace.replaceAll(" ","");
    			if (debug) System.out.println("prefix >"+prefix+"<    namespace >"+namespace+"< ");
    			
    			namespaceMap.put(namespace, prefix);
    			prefixMap.put(prefix, namespace);
    		}
    		
    	}
    	initialized = true;
    }
    
    public static void main(String[] args) {
    	// tester. arg is a file to read, 2nd argv is a key to find
    	      	  	
    	    String filename = "";
    	    String arg1 = "";
    	    boolean displayImage = true;
    	    // displayImage = false;
    	    if (args.length != 0) {
    	   		filename = args[0];
    	    }
    	    if (args.length > 1) {
    	    	arg1 = args[1];
    	    }
    	
    	
    	// load from the file. do a query
    	System.out.println("Pds4NamespaceContext main "+filename+"  arg1="+arg1);
    	Pds4NamespaceContext nsc = new Pds4NamespaceContext(filename);
    	String v = nsc.getNamespaceURI(arg1);
    	System.out.println("getNamespaceURI "+arg1+"  v="+v);
    	v = nsc.getPrefix(arg1);
    	System.out.println("getPrefix "+arg1+"  v="+v);
    	
    	// load from the file. do a query
    	/**
    	System.out.println("Pds4NamespaceContext main "+filename+"  arg1="+arg1);
    	nsc = new Pds4NamespaceContext(filename);
    	v = nsc.getNamespaceURI2(arg1);
    	System.out.println("getNamespaceURI2 "+arg1+"  v="+v);
    	v = nsc.getPrefix2(arg1);
    	System.out.println("getPrefix2 "+arg1+"  v="+v);
    	***/
    	
    }
    
    public String getNamespaceURI2(String prefix)
    {
        if (prefix.equals("pds"))
            return "http://pds.nasa.gov/pds4/pds/v1";
        else if (prefix.equals("dph"))
            return "http://pds.nasa.gov/pds4/dph/v01";
        else if (prefix.equals("xsi"))
            return "http://www.w3.org/2001/XMLSchema-instance";
        else
            return XMLConstants.NULL_NS_URI;
    }
    
    public String getPrefix2(String namespace)
    {
        if (namespace.equals("http://pds.nasa.gov/pds4/pds/v1"))
            return "pds";
        else if (namespace.equals("http://pds.nasa.gov/pds4/dph/v01"))
            return "dph";
        else if (namespace.equals("http://www.w3.org/2001/XMLSchema-instance"))
            return "xsi";
        else
            return null;
    }

}
