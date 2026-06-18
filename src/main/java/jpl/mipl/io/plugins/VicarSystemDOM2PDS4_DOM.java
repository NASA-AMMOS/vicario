/*
*
* @(#)VicarSystemDOM2PDS4_DOM.java	1.0 2014/02/18
 *
 * Steve Levoe
 * Jet Propulsion Laboratory
 * Multimission Image Processing Laboratory
 * PDS4 support
*
***************************************/
// package jpl.mipl.io.plugins.vicar;
// this file and DOMutils want to end up in the above package

package jpl.mipl.io.plugins;

import org.w3c.dom.*;

import java.awt.image.*;

import javax.xml.parsers.*;

import java.io.IOException;
import java.util.*;
import java.text.SimpleDateFormat;

import javax.imageio.metadata.*;

// import VicarIO stuff
// VicarInputFile  SystemLabel
import jpl.mipl.io.streams.*;
import jpl.mipl.io.vicar.*;
import jpl.mipl.io.util.*;

// import jpl.mipl.io.util.Pds4NamespaceContext;

/**
 * This class builds a DOM Document from a Vicar SYSTEM DOM node
 * <BR>
 * The System label type information is extracted from a VICAR_LABEL DOM.
 * This is the information any formats label needs to specify how
 * the data in the image is laid out in the file.
 * Each format will override this class to produce a DOM with the keywords
 * specific to that format. This class will emit a generic DOM which is the
 * main class which should be overridden.
 * <br>
 * Add a way to put filename into this DOM ??
 *
 * user calls getDocument() to get the Document object build here
 */
// public class VicarSystemDOM2PDS4_DOM extends ImageToDOM {
public class VicarSystemDOM2PDS4_DOM  {
    
    String formatName = "pds"; 
    String labelName = "PDS_LABEL";
    String nativeMetadataFormatName = "jpl.mipl.io.plugins.vicar.pdsimage_1.0";
    
    String  pdsLabelType = "PDS4"; // can also be "ODL3" and "PDS4"
    
    // boolean debug = true;
    boolean debug = false;
    
    // Pds4NamespaceContext pdsNamespaceContext = null;
    
    // pds specific variables
    String band_storage_type = "BAND_SEQUENTIAL" ; // "SAMPLE_INTERLEAVED" BAND_SEQUENTIAL   LINE_INTERLEAVED
    // String band_storage_type = "SAMPLE_INTERLEAVED" ; 
    // "BIP" = "SAMPLE_INTERLEAVED"
    // "BSQ" = "BAND_SEQUENTIAL"   
    // "BIL" = "LINE_INTERLEAVED"
    // check the sampleModel to decide this (ignore for now)
    // get the class of the sample model to determine organization  
    // if (sm instanceof ComponentSampleModel) org = "BSQ";
    // only for color images
    String band_sequence = "(RED, GREEN, BLUE)";
    String sample_type = "UNSIGNED_INTEGER";
    
    // file_records isn't known until the file is written
    // that value is calculated when the label is actually written out
    int file_records = 0;
    
    // we cannot calculate this from the image data. It must be passed in via imageWriteParams
    int image_start_byte = 0;
    
    
    
    // int bands = 3; // ImageToDOM already has bands
    
    int nbb = 0; // this is the number of binary prefix bytes per line
       
    PDSimageStatistics pdsImageStatistics = null;
    
    // String keyString = "name"; // or "key"""
    String keyString = "key" ;
    // String versions, calculate must set them ??? - it will use doubles internally ??
    Node vicarSystemNode = null;
    Document _document;
    int bands = 1;
    int record_bytes = 0;
    int width, height = 0;
    int bytes_per_sample = 0;
    int sample_bits = 0;
    
    // values from the vicar SYSTEM label
    int nl = 0;
    int ns = 0;
    int nb = 0;
    int n1, n2, n3, n4 = 0;
    
    int bufsiz = 0;
    int recsize = 0;
    // not used??
    // bhost, bintfmt, brealfmt, bltype, nlb, nbb
    
    String vicar_format = ""; // BYTE, HALF, FULL, REAL, DOUB, COMP
    String vicar_type = "IMAGE"; // must be IMAGE. "IBIS" may be another type we could see
    
    String org = "";
    String intfmt = "";
    String realfmt = "";
    String host = "";
    
    // ???
    int b0size;
    String pds4data_type;
    int axes = 0;
    String filename;
    String reader_format = "VICAR";
    String todays_date;
    
    double _core_base = 0.0; 
    double _core_multiplier = 1.0;
    
    HashMap<String, Integer> vicar_format2bytes = new HashMap<String,Integer>();
    HashMap<String, Boolean>  vicar_format2unsignedFlag = new HashMap<String,Boolean>();	
    
    HashMap<String, String> data_type2format = new HashMap<String,String>();
	HashMap<String, Boolean>  data_type2unsignedFlag = new HashMap<String,Boolean>();	
	HashMap<String, String>  data_type2intFormat = new HashMap<String,String>();		
	HashMap<String, String>  data_type2realFormat = new HashMap<String,String>();	
   
	// public VicarSystemDOM2PDS4_DOM (Node v, Pds4NamespaceContext c) {
	public VicarSystemDOM2PDS4_DOM (Node v) {
		
		vicarSystemNode = v;
		// pdsNamespaceContext = c;
		// check if this is a valid node?? Do that when we try to get values out
         
		initHashMaps();
		
		if (debug)     
			System.out.println("VicarSystemDOM2PDS4_DOM "+formatName+" constructor");
	}
	
    
    
    // ----------------------------------------------------------
    
    /** 
    * This is an override to calculate the number of bytes in a single
    * record based on information specific to the PDS format.<br>
    * This method is called from getValues()
    **/
    public int calcRecord_bytes() {
    
    
    // file_records depends on this value, however it isn't
    // calculated until the file is actually written out
    if (band_storage_type.equals("BAND_SEQUENTIAL") )  {
        record_bytes = width * bytes_per_sample + nbb;
        // file_records = (lines * bands) + label_records;
    }
    else if (band_storage_type.equals("LINE_INTERLEAVED") )  {
        record_bytes = width * bytes_per_sample + nbb;
        // file_records = (lines * bands) + label_records;
    }
    else if (band_storage_type.equals("SAMPLE_INTERLEAVED") )  {
        record_bytes = width * bytes_per_sample * bands; // + nbb ????
        // file_records = lines  + label_records;
    }
    
    if (debug) {
    	System.out.println("ImageToPDS_DOM.calcRecord_bytes "
    	     +band_storage_type+ "  "+record_bytes+"  "+bands+"  "+width); 
		System.out.println(" nbb="+nbb);
    }
    
    return record_bytes;
    
    // "SAMPLE_INTERLEAVED" BAND_SEQUENTIAL   LINE_INTERLEAVED
    // record_bytes = width * bytes_per_sample; 
    // FILE_RECORDS = (lines * bands) + label_records
    // if SAMPLE_INTERLEAVED
    // record_bytes = width * bytes_per_sample * bands;
    // FILE_RECORDS = lines  + label_records
    }
    
    
    public void setPDSimageStatistics(PDSimageStatistics imageStatistics) {
    	pdsImageStatistics = imageStatistics;
    }
    
    public PDSimageStatistics setPDSimageStatistics() {
    	return pdsImageStatistics ;
    }
    
    
    public void setPdsLabelType(String _pdsLabelType) {
		pdsLabelType = _pdsLabelType ;
	}
    
    public void setImageStartByte(int i) {
		image_start_byte = i ;
	}
    
    public void setReader_format(String s) {
		reader_format = s ;
	}
    
    public String getReader_format(String s) {
		return reader_format ;
	}
	
	public String getPdsLabelType() {
		return pdsLabelType ;
	}
    
	/**
	 * getBands
	 * can be used by PDS4ImageWriter to determine out put label template
	 * @return int bands 
	 */
	public int getBands() {
		return bands ;
	}
	
	  
    public void setFilename(String f) {
        filename = f;
    }
    
    public String getFilename() {
        return filename ;
    }
    
    // allow a setter???
    public Document getDocument() {
        // should check for null document??
        
        if (_document == null) {
        	if (vicarSystemNode == null) {
        		return _document;
            }
            getValues();
            buildDom();
        }
        return _document;
    }
    
    String getFormatName() {
        return formatName;
    }
    
    public void setDebug( boolean d) {
    	debug = d;
    }
    
    
    public void setNativeMetadataFormatName(String name) {
        nativeMetadataFormatName = name;
    }
    
    public String getNativeMetadataFormatName() {
        return nativeMetadataFormatName;
    }
    
    /**
    * This class will get all the data values from the VICAR DOM and place
    * them in global variables. buildDOM() should be called next to construct a 
    * Document using the values. Always use BufferedImage since RenderedImage 
    * implements BufferedImage. We can get the values we need from BufferedImage. 
    * This class should not need to be overidden. buildDOM is the class to overide
    * for a specific format
    ***/
    public void getValues () 
    {
    if (debug) System.out.println("--------------- getValues -------- ");
    // set a flag to show we already did this ???  
    
    DOMutils domUtils = new DOMutils();
    // parse the vicarSystemNode
    String xPath = "//item[@name='FORMAT']"; 
    // we check that vicarSystemNode != null before we get here
	String nodeValue = domUtils.getNodeValue(vicarSystemNode, xPath);
	if (debug) {
		System.out.println(" "+xPath+" >"+nodeValue+"< ");
	}
	vicar_format = nodeValue;
	
	// ignore since we don't use: BUFSIZ,DIM,EOL,N1,N2,N3,N4,NBB,NBB,BHOST,BINTFMT,BREALFMT,BLTYPE
	

	xPath = "//item[@name='RECSIZE']"; 
	nodeValue = domUtils.getNodeValue(vicarSystemNode, xPath);
	if (debug) { System.out.println(" "+xPath+" >"+nodeValue+"< ");}
	try {
        recsize = Integer.parseInt(nodeValue);
        } 
	catch (NumberFormatException  nfe) {        
           System.out.println("NumberFormatException "+nfe);
           System.out.println("no value found for "+xPath);
           recsize = 0;
        }
	
	xPath = "//item[@name='ORG']"; 
	nodeValue = domUtils.getNodeValue(vicarSystemNode, xPath);
	if (debug) {
		System.out.println(" "+xPath+" >"+nodeValue+"< ");
	}
	org = nodeValue;
    
	xPath = "//item[@name='NL']"; 
	nodeValue = domUtils.getNodeValue(vicarSystemNode, xPath);
	if (debug) { System.out.println(" "+xPath+" >"+nodeValue+"< ");}
	try {
        nl = Integer.parseInt(nodeValue);
        } 
	catch (NumberFormatException  nfe) {        
           System.out.println("NumberFormatException "+nfe);
           System.out.println("no value found for "+xPath);
           nl = 0;
        }
	xPath = "//item[@name='NS']"; 
	nodeValue = domUtils.getNodeValue(vicarSystemNode, xPath);
	if (debug) { System.out.println(" "+xPath+" >"+nodeValue+"< ");}
	try {
        ns = Integer.parseInt(nodeValue);
        } 
	catch (NumberFormatException  nfe) {        
           System.out.println("NumberFormatException "+nfe);
           System.out.println("no value found for "+xPath);
           ns = 0;
        }
    
	xPath = "//item[@name='NB']"; 
	nodeValue = domUtils.getNodeValue(vicarSystemNode, xPath);
	if (debug) { System.out.println(" "+xPath+" >"+nodeValue+"< ");}
	try {
        nb = Integer.parseInt(nodeValue);
        } 
	catch (NumberFormatException  nfe) {        
           System.out.println("NumberFormatException "+nfe);
           System.out.println("no value found for "+xPath);
           nb = 0;
        }
    
	xPath = "//item[@name='HOST']"; 
	nodeValue = domUtils.getNodeValue(vicarSystemNode, xPath);
	if (debug) {
		System.out.println(" "+xPath+" >"+nodeValue+"< ");
	}
	host = nodeValue;
	
	xPath = "//item[@name='INTFMT']"; 
	nodeValue = domUtils.getNodeValue(vicarSystemNode, xPath);
	if (debug) {
		System.out.println(" "+xPath+" >"+nodeValue+"< ");
	}
	intfmt = nodeValue;
	
	xPath = "//item[@name='REALFMT']"; 
	nodeValue = domUtils.getNodeValue(vicarSystemNode, xPath);
	if (debug) {
		System.out.println(" "+xPath+" >"+nodeValue+"< ");
	}
	realfmt = nodeValue;
	
	
	
    
    width = ns;
    height = nl;
    bands = nb;
    
    
    
    if (debug) {
    	System.out.println("height="+height+"  width="+width+"  bands="+bands );
    	
    }
    
    // this part is tricky, the values depend on the output sample interleave type
    // for now I'll pretend all sample sizes are multiples of 8
    // bytes_per_sample is used to calculate other things
    // determine bytes per sample from vicar_format
    bytes_per_sample = vicar_format2bytes.get(vicar_format).intValue();
    
    sample_bits = bytes_per_sample * 8;
    
    // now get all the PDDS4 values based on the values from VICAR
    // determine pds4data_type from: vicar_format, intfmt, realfmt
    pds4data_type = getPds4data_type(vicar_format, intfmt, realfmt);
    
    // determine from vicar_org (org)
    
    if (bands == 1) {
    	axes = 2;
    } else {
    	axes = 3;
    }
    
    
    // each format will need to overide this to use information specifc to the format
    // for calculating the size of a single record
    record_bytes = calcRecord_bytes(); 
    // record_bytes = width * bytes_per_sample * bands;
    
    if (debug) {
    	System.out.println("  ######################################################## ");
    	System.out.println("  record_bytes="+record_bytes+"  bytes_per_samples="+bytes_per_sample+" sample_bits="+sample_bits );
    	System.out.println("  width="+width+"  height="+height+" bands="+bands );
      }
    } // getValues
    /**
    * This is the class each format MUST override to construct a Document
    * with Elements specific to that format
    **/
    public void buildDom () 
    {
    if (debug) {
    	System.out.println("--------------- buildDom -------- ");
    	System.out.println("=========== pdsLabelType = "+pdsLabelType + "  =======================================");
    	System.out.println("--------------- buildDom -------- 2");
    }
    
    
    /******* 
     * Now do the real construction of the PDS Document.
     * All of the values used to create the PDS specific Document are 
     * derived in the getValues()method of the superclass ImageToDOM
     * when the class is constructed.
     **/
    try {
          // DocumentBuilder builder = factory.newDocumentBuilder();
          // document = builder.newDocument();  // Create from whole cloth
          // look at DOMUtils. create the Document in the same way
          // them we know it will work with the serializer, XPath, XSL tools
          // probably we should ALWAYS get new Documents from DOMUtils
          
          DOMutils domUtils = new DOMutils();
          _document = domUtils.getNewDocument();
          
          // ----------------------------
          Element system = null;
          Element root = null;
          if ( pdsLabelType.equalsIgnoreCase("PDS4")) {
        	  // don't need or want the extra Element
        	  if (debug) System.out.println("--------------- buildDom ---- PDS4 --- 3");
        	  root = (Element) _document.createElement("PDS_LABEL"); 
        	  _document.appendChild (root);
        	  system = root;
          } else {
        	  // probably will not get here
        	  root = (Element) _document.createElement(nativeMetadataFormatName); 
        	  // documentNameNode.appendChild(root);
              _document.appendChild (root);
              if (debug) System.out.println("--------------- buildDom -------- 3");
              
              system = _document.createElement("PDS_LABEL");
              // system.setAttribute("format", formatName);
              // system.setAttribute("type", "SYSTEM");
              root.appendChild (system);
          }
          
          
          
          // put everything inside system
          // this node can be extracted later and merged with a Document with the SAME
          // nativeMetadataFormatName
          Element item;
          String value;
          Text text; // this is Node's "value" Element
          // <PDS_VERSION_ID>PDS3</PDS_VERSION_ID> or <PDS3>PDS_VERSION_ID</PDS3>
          if (debug) System.out.println("--------------- buildDom ---pdsLabelType="+pdsLabelType+" ---- 3.5 ");
          if (pdsLabelType.contains("PDS")) { 
        	  if (debug) System.out.println("--------------- buildDom --  pdsLabelType.contains(\"PDS\") -- 3");
        	  item = (Element) _document.createElement("PDS_VERSION_ID"); 
        	  text = (Text) _document.createTextNode(pdsLabelType); // PDS3 or PDS4
        	  item.appendChild(text);
        	  system.appendChild(item);
          } else if (pdsLabelType.contains("ODL")) {
        	  if (debug) System.out.println("--------------- buildDom --  pdsLabelType.contains(\"ODL\") -- 3");
        	  item = (Element) _document.createElement("ODL_VERSION_ID"); 
        	  text = (Text) _document.createTextNode(pdsLabelType);
        	  item.appendChild(text);
        	  system.appendChild(item);
          } else  { // default . The OLD way
        	  if (debug) System.out.println("--------------- buildDom --  else -- 3");
        	  item = (Element) _document.createElement("PDS_VERSION_ID"); 
        	  text = (Text) _document.createTextNode("PDS3");
        	  // text = (Text) _document.createTextNode( pdsLabelType);
        	  item.appendChild(text);
        	  system.appendChild(item);
          } 
          
          
          // filename
          if (debug) System.out.println("ImageToPDS_DOM.buildDom filename = "+filename);
          if (filename != null) {
            item = (Element) _document.createElement("INPUT_FILENAME"); 
	        text = (Text) _document.createTextNode(filename);
	        item.appendChild(text);
            system.appendChild(item);
          }
          
          
          item = (Element) _document.createElement("item"); 
          item.setAttribute(keyString, "RECORD_TYPE"); 
          item.setAttribute("quoted", "false"); 
	      text = (Text) _document.createTextNode("FIXED_LENGTH");
	      item.appendChild(text);
          system.appendChild(item);
          
          item = (Element) _document.createElement("item"); 
          item.setAttribute(keyString, "RECORD_BYTES"); 
          item.setAttribute("quoted", "false"); 
	      text = (Text) _document.createTextNode(""+record_bytes);
	      item.appendChild(text);
          system.appendChild(item);
       
          // this is a really a place holder, file_records will be calculated when the 
          // file is written out
          item = (Element) _document.createElement("item"); 
          item.setAttribute(keyString, "FILE_RECORDS"); 
          item.setAttribute("quoted", "false");
	      text = (Text) _document.createTextNode("("+height+"*BANDS)+LABEL_RECORDS");
	      item.appendChild(text);
          system.appendChild(item);
          
          
          
          if ( pdsLabelType.equalsIgnoreCase("PDS4")) {
        	  // add some PDS4 specific items
        	  // "LABEL_RECORDS", 
        	  // axes -> from BANDS
        	  // "image_start_byte" => offset
        	  // pds4_data_type -> SAMPLE+TYPE + SAMPLE_BITS
        	  // axis_index_order -> from BAND_STORAGE_TYPE
        	  // "detachedFilename"
        	  // add todays date??
        	  // core_base, core_multiplier
        	  // nl = IMAGE.LINES, ns = IMAGE.LINE_SAMPLES
        	  String objectStr = "OBJECT"; // object"
              Element object = (Element) _document.createElement(objectStr); 
              // "^IMAGE"  ^ is an illegeal charater for an element name
              // may need to go to something else if IMAGE is used elsewhere
              // perhaps IMAGE_OBJECT
    	      // object.setAttribute("name", "IMAGE_DATA"); 
    	      object.setAttribute("name", "PDS4_IMAGE");
              system.appendChild(object);
              
              item = (Element) _document.createElement("item"); 
              item.setAttribute(keyString, "nl"); 
              // item = (Element) _document.createElement("nl");               
    	      text = (Text) _document.createTextNode(""+height);
    	      item.appendChild(text);
              object.appendChild(item);
              
              item = (Element) _document.createElement("item"); 
              item.setAttribute(keyString, "ns");               
    	      text = (Text) _document.createTextNode(""+width);
    	      item.appendChild(text);
              object.appendChild(item);
              
              item = (Element) _document.createElement("item"); 
              item.setAttribute(keyString, "nb");               
    	      text = (Text) _document.createTextNode(""+bands);
    	      item.appendChild(text);
              object.appendChild(item);
              
              item = (Element) _document.createElement("item"); 
              item.setAttribute(keyString, "axes"); 
              if (bands > 1) {
            	  text = (Text) _document.createTextNode("3");
              } else {
            	  text = (Text) _document.createTextNode("2");
              }
    	      item.appendChild(text);
              object.appendChild(item);
              
              item = (Element) _document.createElement("item"); 
              item.setAttribute(keyString, "core_base");             
    	      text = (Text) _document.createTextNode("0.0");
    	      item.appendChild(text);
              object.appendChild(item);
              
              item = (Element) _document.createElement("item"); 
              item.setAttribute(keyString, "core_multiplier");              
    	      text = (Text) _document.createTextNode("1.0");
    	      item.appendChild(text);
              object.appendChild(item);
              
              item = (Element) _document.createElement("item"); 
              item.setAttribute(keyString, "checksum32ch"); 
              // evemtually get a real one from the statistics obhect
    	      // text = (Text) _document.createTextNode("0123456789012345678901");
    	         text = (Text) _document.createTextNode("0123456789ABCDEF012345");
    	      item.appendChild(text);
              object.appendChild(item);
              
              item = (Element) _document.createElement("item"); 
              item.setAttribute(keyString, "offset"); 
    	      text = (Text) _document.createTextNode(""+image_start_byte);
    	      item.appendChild(text);
              object.appendChild(item);
              
              item = (Element) _document.createElement("item"); 
              item.setAttribute(keyString, "reader_format"); 
    	      text = (Text) _document.createTextNode(reader_format);
    	      item.appendChild(text);
              object.appendChild(item);
              
              // int file_records = this.file_records * this.file_records;
              item = (Element) _document.createElement("item"); 
              item.setAttribute(keyString, "file_records");  
    	      text = (Text) _document.createTextNode(""+this.file_records);
    	      item.appendChild(text);
              object.appendChild(item);
              
              String d = getDateNowZ();
              item = (Element) _document.createElement("item"); 
              item.setAttribute(keyString, "todays_date");   
    	      text = (Text) _document.createTextNode(d);
    	      item.appendChild(text);
              object.appendChild(item);
              
              // String pds4data_type = getPds4data_type();
              item = (Element) _document.createElement("item"); 
              item.setAttribute(keyString, "pds4_data_type"); 
                 
    	      text = (Text) _document.createTextNode(pds4data_type);
    	      item.appendChild(text);
              object.appendChild(item);
              
              if (filename != null) {
            	  item = (Element) _document.createElement("item"); 
                  item.setAttribute(keyString, "detached_filename");
      	        text = (Text) _document.createTextNode(filename);
      	        item.appendChild(text);
                 object.appendChild(item);
                }
              
              if (pdsImageStatistics != null) {         		
            		pdsImageStatistics.addItems(_document, object, keyString);
              }
        	  
          }
          
          // this is also really a place holder, label_records will be calculated when the 
          // file is written out
          item = (Element) _document.createElement("IMAGE_START_RECORD"); 
          
          // item.setAttribute(keyString, "IMAGE"); 
          // item.setAttribute("quoted", "false"); 
	      text = (Text) _document.createTextNode("LABEL_RECORDS+1");
	      item.appendChild(text);
          system.appendChild(item);
          
          // leave this comment out
          // item = (Element) _document.createElement("comment"); 
	      // text = (Text) _document.createTextNode("/* this is the IMAGE object description */");
	      // item.appendChild(text);
          // system.appendChild(item);
          
          String objectStr = "OBJECT"; // object"
          Element object = (Element) _document.createElement(objectStr); 
          // "^IMAGE"  ^ is an illegeal charater for an element name
          // may need to go to something else if IMAGE is used elsewhere
          // perhaps IMAGE_OBJECT
	      // object.setAttribute("name", "IMAGE_DATA"); 
	      object.setAttribute("name", "IMAGE");
          system.appendChild(object);
          
          // put all these items in the "^IMAGE" object
          item = (Element) _document.createElement("item"); 
          item.setAttribute(keyString, "INTERCHANGE_FORMAT"); 
          item.setAttribute("quoted", "false"); 
	      text = (Text) _document.createTextNode("BINARY");
	      item.appendChild(text);
          object.appendChild(item);
          
          item = (Element) _document.createElement("item"); 
          item.setAttribute(keyString, "LINES"); 
          item.setAttribute("quoted", "false"); 
	      text = (Text) _document.createTextNode(""+height);
	      item.appendChild(text);
          object.appendChild(item);
          
          if (nbb != 0) {
          
		    item = (Element) _document.createElement("item"); 
		    item.setAttribute(keyString, "LINE_PREFIX_BYTES"); 
			item.setAttribute("quoted", "false"); 
			text = (Text) _document.createTextNode(""+nbb);
			item.appendChild(text);
			object.appendChild(item);
          }
          
          item = (Element) _document.createElement("item"); 
          item.setAttribute(keyString, "LINE_SAMPLES"); 
          item.setAttribute("quoted", "false"); 
	      text = (Text) _document.createTextNode(""+width);
	      item.appendChild(text);
          object.appendChild(item);
          
          item = (Element) _document.createElement("item"); 
          item.setAttribute(keyString, "SAMPLE_TYPE"); 
          item.setAttribute("quoted", "false"); 
	      text = (Text) _document.createTextNode(sample_type);
	      item.appendChild(text);
          object.appendChild(item);
          
          item = (Element) _document.createElement("item"); 
          item.setAttribute(keyString, "SAMPLE_BITS"); 
          item.setAttribute("quoted", "false"); 
	      text = (Text) _document.createTextNode(""+sample_bits);
	      item.appendChild(text);
          object.appendChild(item);
          
          item = (Element) _document.createElement("item"); 
          item.setAttribute(keyString, "BANDS"); 
          item.setAttribute("quoted", "false"); 
	      text = (Text) _document.createTextNode(""+bands);
	      item.appendChild(text);
          object.appendChild(item);
          
          
          /** MER sis doesn't include this item **           
          if (bands == 3) {
            item = (Element) _document.createElement("item"); 
            item.setAttribute(keyString, "STORAGE_SEQUENCE"); 
            item.setAttribute("quoted", "true"); 
	        text = (Text) _document.createTextNode(band_sequence);
	        item.appendChild(text);
            object.appendChild(item);
          }
          ************************************************/
          
          item = (Element) _document.createElement("item"); 
          item.setAttribute(keyString, "BAND_STORAGE_TYPE"); 
          item.setAttribute("quoted", "false"); 
	      text = (Text) _document.createTextNode(band_storage_type);
	      item.appendChild(text);
          object.appendChild(item);
          
          
          if (pdsImageStatistics != null && !pdsLabelType.equalsIgnoreCase("PDS4")) {         		
          		pdsImageStatistics.addItems(_document, object, keyString);
          }
          
          
          
          
          
          
        } catch (Exception e) {
            // Parser with specified options can't be built
            System.out.println("VicarSystemDOM2PDS4_DOM.buildDOM() Exception "+ e );
            e.printStackTrace();

        }
        
        if (debug) {
        	System.out.println("--------------- buildDom -------- 5");
        	System.out.println("VicarSystemDOM2PDS4_DOM.buildDOM() ");
        }
        /***
        catch (ParserConfigurationException pce) {
            System.out.println("buildDocument ParserConfigurationException "+ pce );
        }
        catch (IOException ioe) {
            System.out.println("buildDocument IOException "+ ioe );
        }
        catch (SAXException saxe) {
            System.out.println("buildDocument SAXException "+ saxe );
        }
        ****/
    
    } // buildDom
    
    
    public String getPds4data_type(String _vicar_format, String _intfmt, String _realfmt) {
    	String pds4data_type = "";
    	
    	int bytes = bytes_per_sample;
    	// this data is in JAVA / LSB / LOW
    	
    	 if (_vicar_format.equalsIgnoreCase("BYTE")) pds4data_type = "UnsignedByte" ; // 'SignedByte'
    	 if (_vicar_format.equalsIgnoreCase("HALF")) { // vicar HALF is always Signed
    		 if (_intfmt.equalsIgnoreCase("LOW")) {
    			 pds4data_type = "SignedLSB2"; 
    		 } else {
    			 pds4data_type = "SignedMSB2"; 
    		 }    		 
    	 }
    	 
    	 if (_vicar_format.equalsIgnoreCase("FULL")) { // vicar FULL is always Signed
    		 if (_intfmt.equalsIgnoreCase("LOW")) {
    			 pds4data_type = "SignedLSB4"; 
    		 } else {
    			 pds4data_type = "SignedMSB4"; 
    		 }    		 
    	 }
    	 
    	 if (_vicar_format.equalsIgnoreCase("REAL")) { // vicar FULL is always Signed
    		 if (_intfmt.equalsIgnoreCase("LOW")) {
    			 pds4data_type ="IEEE754LSBSingle";
    		 } else {
    			 pds4data_type = "IEEE754MSBSingle"; 
    		 }    		 
    	 }
    	 
    	 if (_vicar_format.equalsIgnoreCase("DOUB")) { // vicar FULL is always Signed
    		 if (_intfmt.equalsIgnoreCase("LOW")) {
    			 pds4data_type ="IEEE754LSBDouble";
    		 } else {
    			 pds4data_type = "IEEE754MSBDouble"; 
    		 }    		 
    	 }
    	 
    	 // COMP ??? probably never see this
    	 if (_vicar_format.equalsIgnoreCase("COMP")) { // vicar FULL is always Signed
    		 if (_intfmt.equalsIgnoreCase("LOW")) {
    			 pds4data_type ="ComplexLSB16";
    		 } else {
    			 pds4data_type = "ComplexMSB16"; 
    		 }    		 
    	 }
 

    	
    	return pds4data_type;
    }

    public String getDateNowZ() {
        	// <start_date_time>1997-07-07T23:48:33.442Z</start_date_time>
        	// <creation_date_time>2009-05-04T13:46:30.1158Z</creation_date_time>
        	
        	Date dNow = new Date( );
            SimpleDateFormat ft = new SimpleDateFormat ("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
           
            return ft.format(dNow);
        }
  
  // from VicarLabel.java    
    public String toString()
    {
	    return "VicarSystemDOM2PDS4_DOM.toString()";
    }
    
    
    /****
     * initHashMaps
     * 
     * intialize hashMaps used to convert vicar values to PDS4 and other needed values
     */
    private void initHashMaps() {
    	
    	/**
    	 * HashMap<String, Integer> vicar_format2bytes = new HashMap<String,Integer>();
    	 * HashMap<String, Boolean>  vicar_format2unsignedFlag = new HashMap<String,Boolean>();	
    	 */
    	
    	vicar_format2bytes.put("BYTE", 1);
    	vicar_format2bytes.put("HALF", 2);
    	vicar_format2bytes.put("FULL", 4);
    	vicar_format2bytes.put("REAL", 4);
    	vicar_format2bytes.put("DOUB", 8);
    	vicar_format2bytes.put("COMP", 8);
    	
    	vicar_format2unsignedFlag.put("BYTE", new Boolean("true"));
    	vicar_format2unsignedFlag.put("HALF", new Boolean("false"));
    	vicar_format2unsignedFlag.put("FULL", new Boolean("false"));
    	vicar_format2unsignedFlag.put("REAL", new Boolean("true"));
    	vicar_format2unsignedFlag.put("DOUB", new Boolean("true"));
    	vicar_format2unsignedFlag.put("COMP", new Boolean("true"));
    
    }


}