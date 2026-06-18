/*
 * @(#)PDS4InputFile.java	
 * 
 * @author Steve Levoe NASA/JPL
 
 * 01-2014
 * PDS4 file format reader
 *
 */
 


package jpl.mipl.io.vicar;




import java.io.*;

import com.sun.media.jai.codec.*;

// import java.lang.reflect.*;
// import java.beans.*;
import java.awt.image.*;
// import javax.media.jai.*;
// import java.util.Vector;
import java.util.*;

import jpl.mipl.io.ImageUtils;
// import jpl.mipl.io.codec.*;
// import jpl.mipl.io.vicar.*;
import jpl.mipl.io.plugins.*;
import jpl.mipl.io.util.DOMutils;
import jpl.mipl.io.util.Pds4NamespaceContext;

// perl utilities for parsing
// import org.apache.oro.text.perl.*;

// import jpl.mipl.io.plugins.vicar.*;


/*$$$$ Enable for IIO */
// 9-28-01 commented out
// import javax.media.imageio.stream.*; // EA1
import javax.imageio.stream.*; 

/*$$$$*/
import jpl.mipl.io.streams.*;

import org.apache.xpath.XPathAPI;
import org.w3c.dom.*;
import org.w3c.dom.traversal.NodeIterator;
// import org.xml.sax.SAXException;



import javax.media.jai.*;
import javax.xml.namespace.NamespaceContext;
import javax.xml.transform.TransformerException;

import java.awt.Rectangle;
import java.nio.ByteOrder;



/** 
 * This class manages a single PDS4 input image file.
 * <p>
 * All accesses to the PDS4 file are thread-safe, assuming that nobody else
 * tries to access the underlying stream directly.  Thus, multiple threads
 * can issue simultaneous <code>readRecord()</code> or <code>readTile()</code>
 * requests, although each request is handled one at a time via synchronization
 * on the <code>PDSInputFile</code> object.  However, if you have a
 * sequential-only stream, all accesses must still be strictly sequential...
 * meaning that the use of multiple threads with sequential streams will not
 * work (the request order would be non-deterministic).  For random-hard
 * streams, threads will work but could cause performance hits depending on
 * the ordering of the requests.  Random-easy streams should be fine.
 * <p>
 * This reader is capable of reading embedded Vicar labels. If one is encountered 
 * a VicarLabel Object will be created and filled. This Object will be placed
 * in properties as "vicar_label" so other programs may access the information
 * contained in the label.
 * <p> Currently only supports 8 and 16 bit image types, and 32 bit IEEE_REAL
 * <br>
 * @see VicarInputImage
 * @see VicarInput
 * 
 * There is a PDSInputFile. We are NOT extending it
 * PDSInputFile and PDS4InputFile both extend VicarInputFile
 * VicarInputFile is used because PDS4 and PDS input files both
 * are simple rasters which read correctly by. 
 * In the future the PDS4InputFile may also be required to read
 * non image files. PDS4 has a Table format.
 * Since this is ImageIO it may never need to worry about the PDS4 table files.
 * 
 */


public class PDS4InputFile extends VicarInputFile
{
	
	
    // VicarInputFile implements VicarInput
    
    


    // protected VicarLabel _label;
    public VicarLabel _embeddedVicarLabel;
    public boolean _hasEmbeddedVicarLabel = false;
    int _embedded_label_start = -1;
    
    
    
    // VicarPdsIsisImageDecodeParam _imageDecodeParam = null;
    // this should be in VicarInputFile
    ImageDecodeParam _imageDecodeParam = null;
    
    Document _PDS_document; // this is the holder of the PDS metadata
    Document _Vicar_document; // this is the holder of the Vicar metadata
    // PDSMetadata pdsMetadata = null;
    boolean gotMetadata = false;
    
    PDS4SystemLabel _pds4System = null; // PDS and ISIS have the same extra stuff
    
    // for testing
    private int _readMin, _readMax, _readCt;
    int _line_prefix_bytes = 0;
    int _line_suffix_bytes = 0;
    
    int _ssb = 0;
    int _lsb = 0;
    int _bsb = 0;
    
    int _lpb = 0;
    
   boolean debug = false;
   // boolean debug = true;
   
   // default this to true ???
   boolean detachedLabel = false;
   String detachedFilename = null;
   
   ImageInputStream detachedImageInputStream = null;
   Object detachedLabelStream = null;
   
   String _pds4_fao_type = "";
   String _File_Area_Observational_type = ""; // "unknown" ??
   
   // either a Array_ or Table_ inside File_Area_Observational
   // also include versions without pds: namespace??
   String[] _pds4_array_types = {"//pds:Array_2D_Image","//pds:Array_3D_Image","//pds:Array_3D_Spectrum","//pds:Array_2D_Spectrum"} ;
   // String[] _array_types = {"//Array_2D_Image","//Array_3D_Image","//Array_3D_Spectrum","//Array_2D_Spectrum"} ;
   // String[] _pds_table_types = {"//Table_Binary","//Table_Character", "//Table_Delimited"};
   String[] _pds4_table_types = {"//pds:Table_Binary","//pds:Table_Character", "//pds:Table_Delimited"};
   
  
  // on linux ?? /usr/local/lib/liboaljni.so.1
  String oalNativeLibName = "oaljni";
  // String oalNativeLibName = "hellop";
  
   boolean goNative = false; // this will be set to true if the OAL C native library can
   // be loaded. The flag will then be used to determine if native imnterface calls 
   // should be used.
    
   OaImageKeywords oaImageKeywords = null;
   
   // already in VicarInputFile
   // boolean _flip_image_horizontal = false;
   // boolean _flip_image_vertical = false;

    // 20110907, xing
    PDSImageReadParam pdsImageReadParam;
   
    /**
	HashMap<String, String> data_type2format = new HashMap<String,String>();
	HashMap<String, Boolean>  data_type2unsignedFlag = new HashMap<String,Boolean>();	
	HashMap<String, String>  data_type2intFormat = new HashMap<String,String>();		
	HashMap<String, String>  data_type2realFormat = new HashMap<String,String>();		
    ***/
    
    /**
     * The attribute pds:data_type must be equal to one of the following values 
     * 'ComplexLSB16', 'ComplexLSB8', 'ComplexMSB16', 'ComplexMSB8', 'IEEE754LSBDouble', 
     * 'IEEE754LSBSingle', 'IEEE754MSBDouble', 'IEEE754MSBSingle', 'SignedBitString', 
     * 'SignedByte', 'SignedLSB2', 'SignedLSB4', 'SignedLSB8', 'SignedMSB2', 'SignedMSB4', 
     * 'SignedMSB8', 'UnsignedBitString', 'UnsignedByte', 'UnsignedLSB2', 'UnsignedLSB4', 
     * 'UnsignedLSB8', 'UnsignedMSB2', 'UnsignedMSB4', 'UnsignedMSB8'.</sch:assert>
    * </sch:rule>
    * create Hashmaps give the data_type String, get back the value for each vicar variable
    * which a SystemLabel needs:
	*	format, intFormat, realFormat, unsignedFlag
	* all of this is handled inside PDS4SystemLabel
	* 
	* Add in something to Handle Table_ types
     */
   
////////////////////////////////////////////////////////////////////////

/***********************************************************************
 * Dummy constructor (for now). Need to add good ones that call open().
 */
    public PDS4InputFile()
    {
	super();
	if (debug) System.out.println("%%%%%%% PDSInputFile constructor $$$$$$$$$$$$$$$");
    }

    // 20110709, xing
    public PDS4InputFile(PDSImageReadParam pdsImageReadParam) {
        super();
        this.pdsImageReadParam = pdsImageReadParam;
        if (debug) System.out.println("%%%%%%% PDSInputFile constructor $$$$$ with PDSImageReadParam");
    }

/***********************************************************************
 * Dummy constructor (for now). Need to add good ones that call open().
 */
    // public PDSInputFile(VicarPdsIsisImageDecodeParam imageDecodeParam)
    public PDS4InputFile(ImageDecodeParam imageDecodeParam)
    {
	super();
	_imageDecodeParam = imageDecodeParam;
	// this will later be passed on to the super. 
	// Not now because other changes to that class will be implemented at the same time
	// super(imageDecodeParam) ; 
	// VicarPdsIsisImageDecodeParam _imageDecodeParam = null;
    // ImageDecodeParam imageDecodeParam
	
	// if (debug) System.out.println("%%%%%%% PDSInputFile constructor $$$$$ with VicarPdsIsisImageDecodeParam");
	if (debug) System.out.println("%%%%%%% PDSInputFile constructor $$$$$ with ImageDecodeParam");
    }


/***********************************************************************
 * Constructor that calls <code>open(String)</code>.
 *
 * @param fn name of the file to open
 * @throws IOException
 */
    public PDS4InputFile(String fn) throws IOException
    {
	this();
	open(fn);
	
    
    }
    
	public void setDebug(boolean d) {
		debug = d;
		if (debug) System.out.println("PDSInputFile.debug is now true");
	}

	/***********************************************************************
	 * Opens a file given a filename.
	 * What about URL's?
	 * @throws IOException
	 */
		public synchronized void open(String fn) throws IOException
		{
		filename = fn;
		if (debug) System.out.println("PDSInputFile.open("+fn+")");
		
		open(new RandomAccessFile(fn, "r"));
			
		}

	

/*
 * 
 * openInternal() has been eliminated.
 * setupLabels() does the PDS specific part and is called from openInternal()
 * in VicarInputFile
 */
 
	protected void setupLabels() {
	// need to decide where DOMutils will live package wise
    // ImageIO is the issue
    // jpl.mipl.util.DOMutils domUtils = new jpl.mipl.util.DOMutils();
    DOMutils domUtils = new DOMutils();
	// BufferedReader input = null;
	// _input_stream
    
    /**************************
	 * The PdsNamespaceContext should be created else where, passed in
	 */
    NamespaceContext pdsNamespaceContext = null ;
    Pds4NamespaceContext pdsNamespaceContextFromXml = null;
	// NamespaceContext pdsNamespaceContext = new Pds4NamespaceContext();
	
	if (debug) {
	    System.out.println("PDS4InputFile.setupLabels() ############################"); 
	    System.out.println("input type: "+_input_stream); 
	}
	// initHashMaps(); // initialize global TreeMaps used in this function
	// They can't be initialized inline so this is the cleanest
	
	long streamLength = 0;
    int byteSize = 10000;
    
	if (_input_stream instanceof ImageInputStream) { 
	
            
            if (debug) System.out.println("setupLabels()  ImageInputStream"); 
            byte[] xml = new byte[byteSize];
            
			try {
				streamLength = ((ImageInputStream) _input_stream).length();
				if (streamLength == -1) {
					// -1 means It couldn't tell. But it didn't throw an exception
					// xml = new byte[byteSize];
					String xml_str = "";
					int readCount = 0;
		        	// get the first 10000 bytes of the stream into byte array 
			        int read_return = 0;
			        do {
	        			 read_return = 0;
	        			 xml = new byte[byteSize]; // new one each time. Otherwise you might get leftover junk from the previous read
	    		        
    		        	// read_return = ((ImageInputStream) _input_stream).read(xml, readCount, byteSize);
    		        	read_return = ((ImageInputStream) _input_stream).read(xml, 0, byteSize);
    		        	readCount += read_return;
    		        	if (read_return < byteSize) {
    		        		// the return is smaller than the allocated array.
    		        		// We must get rid iof any junk at the end. The xml parser will fail otherwise
    		        		byte[] xml_smaller = new byte[read_return];
    		        		
    		        		System.arraycopy(xml, 0, xml_smaller, 0, read_return);
    		        		xml_str += new String(xml_smaller);
    		        	} else {
    		        		xml_str += new String(xml);
    		        	}
    		        	if (debug) {
    		        		System.out.printf("readCount = %d  xml_str.length() = %d  byteSize = %d read_return = %d \n" ,
		            			readCount, xml_str.length(), byteSize, read_return); 
    		        		}
    		        	
			        } while (read_return == byteSize); 
			        
			        //trim  the string to only the number of bytes read
			        
			        xml = xml_str.getBytes();
			        if (debug) {
			        	try {
			        	      FileWriter myWriter = new FileWriter("PDS4_file.xml");
			        	      myWriter.write(xml_str);
			        	      myWriter.close();
			        	      System.out.println("Successfully wrote to the file.");
			        	    } catch (IOException e) {
			        	      System.out.println("An error occurred.");
			        	      e.printStackTrace();
			        	    }
		            	
		            	System.out.println("#################### ImageInputStream xml ###############");
		            	System.out.printf("readCount = %d  xml_str.length() = %d  byteSize = %d \n" ,
		            			readCount, xml_str.length(), byteSize); 		
		            	System.out.printf("stream_length = %d  xml.length = %d ####\n" ,streamLength, xml.length); 	
		            	System.out.println(xml_str); 	 
		            	System.out.println("#################### ImageInputStream xml #################### "); 	 
		            }
					
				} else {
	            	
	            	byteSize = (int) streamLength;
	            
					if (debug) System.out.println("setupLabels()  streamLength="+streamLength+"  byteSize="+byteSize); 
		            xml = new byte[byteSize];
		            // read the data into the byte buffer
		            ((ImageInputStream) _input_stream).readFully(xml);
		            
		            if (debug) {
		            	String xml_str = new String(xml);
		            	System.out.printf("#################### ImageInputStream xml: xml_str.length() = %d  byteSize = %d \n" ,xml_str.length(), byteSize); 		            	
		            	System.out.println(xml_str); 	 
		            	System.out.println("#################### ImageInputStream xml #################### "); 	 
		            }
				} 
	            
	            // create an inputStream from the Byte buffer
	            ByteArrayInputStream is = new ByteArrayInputStream(xml);
	            
	            pdsNamespaceContextFromXml = new Pds4NamespaceContext(is);
	            	            
	            // create an inputStream from the Byte buffer for XML parsing
	            ByteArrayInputStream inputStream = new ByteArrayInputStream(xml);
	            
	           
	            
	            _PDS_document = domUtils.buildDocument(inputStream);
	            if (debug) {
	            	System.out.println("ImageInputStream _PDS_document: "+_PDS_document); 	            
		            /***
		            domUtils.serializeDocument( _PDS_document, "PDS_doument.xml", "xml");
		            ****/
				}
	            
			} catch (IOException e) {
				// TODO Auto-generated catch block
				System.out.println("PDS4InputFile.setupLabels() IOException length() or readFully() on ImageInputStream");
				e.printStackTrace();
				System.out.println("Aborting label read");
				// throw an Exception. Don't catch this one?
				return;
			}
	  
            
		
       } else if (_input_stream instanceof DataInput) {
    	   if (debug) System.out.println("setupLabels()  DataInput"); 
    	   
    	   	try {
    		   // streamLength =  ((DataInput)_input_stream).length()_;
    		   byte[] xml = new byte[byteSize];
    		   ((DataInput)_input_stream).readFully(xml);
    		   
    		   ByteArrayInputStream is = new ByteArrayInputStream(xml);
    		   pdsNamespaceContextFromXml = new Pds4NamespaceContext(is);
    		   
    		   	/// create an inputStream from the Byte buffer
    		   ByteArrayInputStream inputStream = new ByteArrayInputStream(xml);
           
    		   // Document buildDocument(InputStream is)
    		   _PDS_document = domUtils.buildDocument(inputStream);
    		   if (debug) {
    			   System.out.println("DataInput _PDS_document: "+_PDS_document); 
    		   }
    	   	} catch (IOException e) {
				// TODO Auto-generated catch block
				System.out.println("PDS4InputFile.setupLabels() IOException length() or readFully() on DataInput");
				e.printStackTrace();
				System.out.println("Aborting label read");
				// throw an Exception. Don't catch this one?
				return;
    	   }   
    		   
           
            if (debug) {
            	System.out.println("DataInput _PDS_document: "+_PDS_document);
            }
            

       } else {
            System.out.println("Improper input type: "+_input_stream); 
            System.out.println("can't read the header ");
            return;
       }
	
	
	if (debug) {
    	System.out.println("_PDS_document: "+_PDS_document); 
    	domUtils.serializeDocument( _PDS_document, "_PDS_document.xml", "xml");
    }
	
	// look at the Document and decide if this is an Image or a Table
	// what do look for to know if it is a Table??
	
	// now we have read in the label and have a PDS_document
	// should check for "dualie" PDS AND Vicar label
    // if it is a "dualie" get the vicarLabel AND _Vicar_document
    gotMetadata = true;
    
    /**
    // pds4_fao_typen File_Area_Observational
     = findPDS4_file_type(_PDS_document, pdsNamespaceContext ) ;
    // check the type
    if (debug) {
    	System.out.println("pds4_fao_type = "+_pds4_fao_type );
    }
    **/
    // create a SystemLabel from the values in the document?
    
    _system = createSystemLabel(_PDS_document,  pdsNamespaceContextFromXml);
    
    // this is the old default namespace from the jar
    // _system = createSystemLabel(_PDS_document, pdsNamespaceContext ) ;
    
    _pds4System = (PDS4SystemLabel) _system;
    String type = _pds4System.get_File_Area_Observational_type();
    boolean isTable = _pds4System.isTable();
    if (debug) {
    	System.out.println("ImageInputStream _pds4System = "+_pds4System+"  type="+type+" isTable="+isTable );
    }
    if (isTable) {
    	detachedLabel = _pds4System.isDetachedLabel();        
        detachedFilename = _pds4System.getDetachedFilename();
    	
    	// check _lblsize_front if it is -1 ERROR and exit read??
    	if (debug) {
        	System.out.println("PDS4InputFile.setupLabels isTable="+isTable );
        }
    	
    }
    
    _line_suffix_bytes = _pds4System.getLineSuffixBytes();
    _line_prefix_bytes = _pds4System.getLinePrefixBytes(); 
    
    // this._flip_image_horizontal = _pds4System.getFlip_image_horizontal();
    
    _flip_image_horizontal = _pds4System.getFlip_image_horizontal();
    _flip_image_vertical = _pds4System.getFlip_image_vertical();
        
    // this may be handled by looking at the system label ???
    // if the detached image file has some sort of label it will be specified in a 
    // from _pds4system detachedFilename, filesize, parsing_standard_id (PDS3, VICAR, PDS4 etc), offset_bytes
    // from <File> and <Header> areas
    
    int header_ct = _pds4System.getHeader_ct();
    int header_offset_bytes = _pds4System.getHeader_offset_bytes(0);
    int[] header_offsets = _pds4System.getHeader_offset_bytes();
    
    // this is calculated from all the Headers in the SystemLabel
    int headersSize = _pds4System.getHeadersSize();
    
    
    _lblsize_front = headersSize;
    
    int offset = _pds4System.getOffset_bytes();
    // int header_ct = _pds4System.getHeaderCt();
    String[] parsing_standard_id = _pds4System.getParsing_standard_id();
    // get a list of all parsing_standard_ids in the data file
    // _hasEmbeddedVicarLabel false
  
    detachedLabel = _pds4System.isDetachedLabel();
    
    detachedFilename = _pds4System.getDetachedFilename();
	
	// check _lblsize_front if it is -1 ERROR and exit read??
	if (debug) {
		System.out.println("parsing_standard_id = "+parsing_standard_id); 
	    System.out.println("SEARCHING FOR EMBEDDED VICAR LABEL ****************");
	    System.out.println("parsing_standard_id = "+parsing_standard_id+"  "+parsing_standard_id.length); 
	    for (int k=0 ; k< parsing_standard_id.length ; k++) {
	    	System.out.println("parsing_standard_id["+k+"] = "+parsing_standard_id[k]+"  "+header_offsets[k]); 
	    }
	}
   
	// to get metadata etc from detached label the user should query the detached image file
	// somehow add info to Metadata object to indicate that the data file is detached and what type
	// _pds4System.isDetachedLabel(), _pds4System.getParsing_standard_id();
	// of labels it contains
    // determine if there is an embedded vicar label
	// check if one of the Headers in parsing_standard_id is "VICAR2" 
    // where is it ??
	// check for a label of a certain type
	// int vicar_index =  _pds4System.getHeaderIndex("VICAR2");
	// int vicar_start = _pds4System.getHeader_offset(vicar_index);
	// int vicar_label_length = _pds4System.getHeader_object_length(vicar_index);
	
	int imageHeader = 0;
    int recordBytes = 0;
    
    String value = "";
    String units = "";
    
    
          // _hasEmbeddedVicarLabel = true;
          // _embedded_label_start 
      
    
    if (debug) {
    System.out.println("  recordBytes "+recordBytes+"  _hasEmbeddedVicarLabel "+_hasEmbeddedVicarLabel); 
    System.out.println("  _embedded_label_start = "+_embedded_label_start);
    System.out.println("  _lblsize_front "+_lblsize_front+" really the image data start byte" );
    System.out.println("  units "+units);
    System.out.println("  detachedFilename = "+detachedFilename);
    System.out.println("  detachedLabel = "+detachedLabel);
    }
  
  
  
    /***/
    // hasEmbeddedVicarLabel = pdsLabel2Dom.hasEmbeddedVicarLabel ;
    // pdsLabel2Dom should leave _input_stream at the beginning of the VicarLabel !!!
    
    if (_hasEmbeddedVicarLabel) {
    	// readEmbeddedVicarLabel();
	    
    }
	
    
    
	// Set up defaults for missing label items.
	// Note that the host format defaults for input files are VAX, because
	// that was the only kind of file in existence before the host type
	// labels were added.  Output files default to Java.

	if (!_system.isHostValid()) {
	    _system.setHost("VAX-VMS");
	}
	if (!_system.isIntFmtValid()) {
	    // _system.setIntFmt("LOW");
	}
	if (!_system.isRealFmtValid()) {
	    // _system.setRealFmt("VAX");
	}
	
        //static code analysis wants us to break things up
        long nlb   = _system.getNLB();
        long n2    = _system.getN2();
        long n3    = _system.getN3();
        long rec   = _system.getRecsize();
        long n2Xn3 = n2 * n3;
        long nsum  = nlb + n2Xn3;
        _image_size_bytes = nsum * rec;

        //_image_size_bytes = (_system.getNLB() +
	//				(_system.getN2() * _system.getN3()))
	//		* _system.getRecsize();

	

    // _lblsize_front MUST take into account the embedded Vicar label
    // it really is the start of the image data
	_current_file_pos = _lblsize_front;
	
	
	
	}
	
	/**
	 * readPdsLabelString
	 *
	 * read from the stream and get a String containing the PDS label
	 * This method assumes the PDS label's end is signaled by "END"
	 */
	public String readPdsLabelString(ImageInputStream iis) {
		String label = null;
		String s = null;
		String trim = null;
		StringBuffer sb = new StringBuffer();
		// read till we find "END"
		try {
		iis.seek(0) ; // make sure we are the start of the file
		 while ((s = iis.readLine()) != null) {
			trim = s.trim();
			sb.append(s+"\n");
			if (trim.equalsIgnoreCase("END")) {
				label = sb.toString();
				return label;
			}
		 } 
		}
		catch (IOException ioe) {
			System.out.println("IOException reading PDS label ");
			System.out.println(" "+ioe);
			return null;
		}
		
		return label;
	}
	/**
	 * May remove this for PDS4 - make it sop it does nothing ???
	 */
	public void readEmbeddedVicarLabel() {
		if (_hasEmbeddedVicarLabel) {
		DOMutils domUtils = new DOMutils();
	    _embeddedVicarLabel = new VicarLabel();
	    // _embedded_lblsize_front = _label.readLabelChunk((InputStream) _input_stream);
	    
        if (debug) System.out.println("PDSInputFile.openInternal calling readLabelChunk(Object)"+_input_stream);
    
        try {
            if (debug) System.out.println(" * seek to: _embedded_label_start "+ _embedded_label_start );
            if (debug) System.out.println(" ******** _current_file_pos "+ _current_file_pos );
            seekToLocation(_embedded_label_start) ;
            if (debug) System.out.println(" ******** _current_file_pos "+ _current_file_pos );
            int _embedded_lblsize_front = _embeddedVicarLabel.readLabelChunk((Object) _input_stream);
            if (debug) System.out.println(" ******** PDSInputFile.openInternal  read vicar label "+
                _embedded_lblsize_front);
           
            _embeddedVicarLabel.setReadComplete(true);
            
           if (debug) {
            System.out.println(" ******** _embeddedVicarLabel.isReadComplete() "+  
                        _embeddedVicarLabel.isReadComplete() );
           
            String vicStr = _embeddedVicarLabel.toString();
            System.out.println(" ******** ");
            System.out.println(vicStr);
            System.out.println(" ******** ");
            Document doc = domUtils.getNewDocument();
            Node lbl = _embeddedVicarLabel.toXML(doc);
            doc.appendChild(lbl);
            
            domUtils.serializeDocument(doc,"vicar_lbl.xml","xml");
            System.out.println(" ******** serialized to vicar_lbl.xml");
            
           }
        }
        catch (IOException ioe) {
            System.out.println("IOException attempting to read embedded vicar label "+ioe);
            ioe.printStackTrace();
        }
	   }
    }

	/***********************************************************************
	 * Does the actual work of opening the file.  Reads in the first part
	 * of the label, and sets up the SystemLabel object.
	 * @throws IOException
	 */
		protected void openInternal() throws IOException
		{
		// Make sure we're at the beginning of the file/stream.
		// Only does anything if random-access.
		
				
		seekToLocation(0);

		_lblsize_front = 0;
		_lblsize_eol = 0;

		setupLabels();
	
		if (debug) {
			System.out.println("detachedLabel="+detachedLabel+"  detachedFilename="+detachedFilename);
			System.out.println("_File_Area_Observational_type "+_File_Area_Observational_type);
			// Get the host and data formats and set up the VicarDataFormat object.
			System.out.println("_system.getHost() = "+_system.getHost());
			System.out.println("_system.getIntFmt() = "+_system.getIntFmt());
			System.out.println("_system.getRealFmt() = "+_system.getRealFmt());
		}
		_data_format = new VicarDataFormat(_system.getHost(),
				_system.getIntFmt(), _system.getRealFmt());
		
		if (detachedLabel == true ) {
			
			
			if (_File_Area_Observational_type.contains("Table")) {
				if (debug) {
					System.out.println("detachedLabel This is a Table. No need to open the data file now");
				}
				
				openInternalLast();
				return;
				
			}
			
			if (debug) {
				System.out.println("detachedLabel opening the image data file now");
				System.out.println("PDSInputFile.open("+detachedFilename+")");
			}
           // 20110709, xing, 20140201, srl
			String directoryPath = ".";
			if (this.pdsImageReadParam != null) {
	           directoryPath = this.pdsImageReadParam.getDirectoryPath();
	           if (directoryPath == null) {
	        	   directoryPath = ".";
	           }
			}
			
			String fullPath = directoryPath+java.io.File.separator+detachedFilename;
           if (debug) {
               System.out.println("PDSInputFile: directory path is "+directoryPath);
               System.out.println("PDSInputFile: full path is "+fullPath);
           }
           
           ImageUtils imUtil = new ImageUtils() ;
			imUtil.setDebug(debug);
			// This will handle opening local file, URL
			// we may still need to add something to configure web authentication: certificates or CSS
			_input_stream =  imUtil.getImageInputStream(fullPath) ;
			
			/****
			//RandomAccessFile raf = new RandomAccessFile(detachedFilename, "r");
           RandomAccessFile raf = new RandomAccessFile(directoryPath+java.io.File.separator+detachedFilename, "r");
           
           // someday this need to adapted to handle URL's so we can access a webdav file

			
			FileImageInputStream stream = new FileImageInputStream(raf);
			// keep the label stream around (we might use it ???)
			detachedLabelStream = _input_stream;
			// The image is all we will read from now on
			_input_stream = stream;
			_current_file_pos = 0;
			***/
		
		
		if (_hasEmbeddedVicarLabel) {
			// we have switched _input_stream (if this is a detached label) to the one which contains
			// the embedded Vicar label, now we can read the vicar label in
	    	readEmbeddedVicarLabel();
		    
	    }

		// This is a bit messy but avoids having the io.streams package
		// depend on the io.vicar package...

		int int_order = ImageInputStreamStride.HIGH_ORDER;
		if (_data_format.getIntFormatCode() == VicarDataFormat.INT_FMT_LOW)
			int_order = ImageInputStreamStride.LOW_ORDER;

		int float_order = ImageInputStreamStride.HIGH_ORDER;
		// if (_data_format.getIntFormatCode() == VicarDataFormat.REAL_FMT_RIEEE)
		if (_data_format.getRealFormatCode() == VicarDataFormat.REAL_FMT_RIEEE)
			float_order = ImageInputStreamStride.LOW_ORDER;
		// if (_data_format.getIntFormatCode() == VicarDataFormat.REAL_FMT_VAX)
		if (_data_format.getRealFormatCode() == VicarDataFormat.REAL_FMT_VAX)
			float_order = ImageInputStreamStride.VAX_ORDER;

		// If an ImageInputStream, set the byte ordering there too.  If
		// it's VAX or inconsistent, leave it BIG and the Stride class
		// will take care of it (it re-verifies the order is right).
		
		if (debug) {
			System.out.println("PDSInputFile.openInternal()");
			System.out.println("ImageInputStreamStride.LOW_ORDER = "+ImageInputStreamStride.LOW_ORDER);
			System.out.println("_data_format.getRealFormatCode() ="+_data_format.getRealFormatCode());
			System.out.println("VicarDataFormat.REAL_FMT_RIEEE ="+VicarDataFormat.REAL_FMT_RIEEE);
		}

		if (_input_stream instanceof ImageInputStream) {
			if (int_order == ImageInputStreamStride.LOW_ORDER &&
			float_order == ImageInputStreamStride.LOW_ORDER) {
				if (debug) System.out.println("PDSInputFile.openInternal()  ByteOrder.LITTLE_ENDIAN");

			((ImageInputStream)_input_stream).setByteOrder(
							ByteOrder.LITTLE_ENDIAN);
			}
			else {
				if (debug) System.out.println("PDSInputFile.openInternal()  ByteOrder.BIG_ENDIAN");
			
			((ImageInputStream)_input_stream).setByteOrder(
							ByteOrder.BIG_ENDIAN);
			}
		}

		_input_stream_wrap = new ImageInputStreamStride(_input_stream,
						int_order, float_order);

		_file_opened = true;
		// gives subclassers a hook to do something else here
		}
		
		openInternalLast();
		}	


/***********************************************************************
 * openInternalLast
 * 
 * called at the end of openInternal. Can be used by subclasses to do any 
 * extra work once openInternal has completed. Created so 
 * PDSInputFile and ISISInputFile  oculd have the oportunity to modify 
 * _input_stream_wrap. 
 */
protected void openInternalLast() {
	
	// provided for subclasses to put good stuff here
	// this is needed to correctly read some datasets
	if (debug) {
		System.out.println("PDSInputFile.openInternalLast() *************************************");
		System.out.println("_line_prefix_bytes "+_line_prefix_bytes);
		System.out.println("_line_suffix_bytes "+_line_suffix_bytes);
		System.out.println("nbb "+_pds4System.getNBB());
	}
	
	int nl = _system.getNL();
	int ns = _system.getNS();
	
	// Rectangle(int x, int y, int width, int height)
	Rectangle r = new Rectangle(0,0, ns, nl);
	setSourceRegion(r);
	
	// provided for subclasses to put good stuff here
	if (debug) {
		System.out.println("PDS4InputFile.openInternalLast()");
		System.out.println("sourceRegion "+r);	
	}
	
	
	readLinePrefixData(_line_prefix_bytes); // this is a Vicar and PDS only operation
	
	// _line_prefix_bytes = 0; // use _pds4System.getNBB() instead ???
	// _isisSystem.setNBB(0);
	
	// not used currently
	// _input_stream_wrap.setLinePrefixBytes(_line_prefix_bytes);
	// _input_stream_wrap.setLineSuffixBytes(_line_suffix_bytes);
}


    /******************************************************
    * 
    * @param Properties Object
    * intended to be called with the properties of the RenderedImage so 
    * some useful things are
    * put in the images properties. The Application which receives this 
    * image can use these properties. This doesn't seem to work as expected.
    * Some Objects seem to go out os scope and become null.
    * PropertyGenerator is the probable answer.
    *************/
    public void setToProperties(Hashtable properties) {
        
        if (debug) System.out.println("PDSInputFile.setToProperties $$$$$$$$$$$$$$$$$$$$$$");
        
        if (properties != null) {
            String n = "PDS";
            if (debug) System.out.println("put ImageFormatName "+n);
            // properties.put("ImageFormatName", (Object) "n);
            
            // System.out.println("properties: ");
            // System.out.println(properties.toString());
            
         if (_hasEmbeddedVicarLabel) {
            // vif.getHasEmbeddedVicarLabel()
            // putting the label into the images properties allows us to gain access to the
            // image label thru the properies
   
            properties.put("vicar_label", (Object)_embeddedVicarLabel);
         }
        
	     // put things into the properties of the image
	     if (_PDS_document != null) {
	        properties.put("PDS_document", (Object) _PDS_document);
	     }
	     if (_imageDecodeParam != null) {
	       properties.put("ImageDecodeParam", (Object) _imageDecodeParam);
	       properties.put("ImageDecodeParam_ClassName", (Object) _imageDecodeParam.getClass().getName() );
	     }
	     
	     properties.put("SystemLabel", (Object) _system);
	     properties.put("SystemLabel_ClassName", (Object) _system.getClass().getName() );
	     
	     if (debug) System.out.println("properties.size() "+ properties.size());
	    }
	    else {
	       if (debug) System.out.println("properties is NULL");
	    }
	        
        
    }
    
    public String findPDS4_file_type( ) {
    	
    	NamespaceContext pdsNamespaceContext = new Pds4NamespaceContext();
    	return findPDS4_file_type(_PDS_document, pdsNamespaceContext ) ;
    }
    
    public String findPDS4_file_type(Document doc, NamespaceContext pdsNamespaceContext ) {
    	
    	debug = true;
    	if (debug) {
    		System.out.println("==================================================================");
    		System.out.println("*************** pds4InputFile.findPDS4_file_type******************");
    		System.out.println("==================================================================");
    		
    	}
    	Exception e = new Exception();
    	e.printStackTrace();
    	
    	String pds4_file_type = "";
    	 DOMutils domUtils = new DOMutils();
    	 
    	 if (debug) {
         	domUtils.serializeNode(doc, "_XXX_doc.xml", "xml");
         }
    	
    	// looking for <TABLE_ 	or pds:TABLE
    	// looking for <ARRAY_	or pds:ARRAY
    	
    	String xPath = "//pds:File_Area_Observational" ;
    	// String xPath = "//File_Area_Observational" ; // File_Area_Observational
    	if (debug) {
        	System.out.println("findPDS4_file_type xPath "+xPath);
    	}
        // image file details are inside of this Element
        Node fileAreaObsNode = domUtils.getSingleNode(doc,xPath, pdsNamespaceContext);
        if (debug) {
        	System.out.printf("xPath %s name=%s namespace = %s",xPath, fileAreaObsNode.getNodeName(), fileAreaObsNode.getNamespaceURI());
        	domUtils.serializeNode(fileAreaObsNode, "_XXX_pds-File_Area_Observational.xml", "xml");
        }
        
        // determine if this is: //pds:Array_2D_Image, //pds:Array_3D_Image, //pds:Array_3D_Spectrum
        // then go to a case which handles that type
        // xPath = "//Table_Character" ;
        xPath = "//pds:Table_Character" ;
        if (debug) {
        	System.out.println("findPDS4_file_type xPath "+xPath);
        }
    	Node node = domUtils.getSingleNode(doc,xPath, pdsNamespaceContext);   
    	if (debug) {
    		System.out.printf("xPath %s name=%s namespace = %s",xPath, node.getNodeName(), node.getNamespaceURI());
        	domUtils.serializeNode(node, "_XXX_pds-xpath.xml", "xml");
        }
    	
    	xPath = "//pds:File_Area_Observational/pds:File" ;
        if (debug) {
        	System.out.println("findPDS4_file_type xPath "+xPath);
        }
    	node = domUtils.getSingleNode(doc,xPath, pdsNamespaceContext);   
    	if (debug) {
    		if (node != null) {
    			System.out.printf("xPath %s name=%s \n",xPath, node.getNodeName());
    			domUtils.serializeNode(node, "_XXX_pds-xpath-File.xml", "xml");
    		}
        }
    	String xmlFileName = "";
    	for (int i=0 ; i< _pds4_table_types.length ; i++) {
    		if (debug) {
    			System.out.printf("_pds4_table_types[%d] = %s \n", i, _pds4_table_types[i]);
    		}
    		xPath = _pds4_table_types[i];
    		xmlFileName = "_XXX_pds4_table_types"+1+".xml";
            if (debug) {
            	System.out.println("findPDS4_file_type xPath "+xPath);
            }
        	node = domUtils.getSingleNode(doc,xPath, pdsNamespaceContext);   
        	
        	if (node != null) {
        		if (debug) {
        			System.out.printf("xPath %s name=%s \n",xPath, node.getNodeName());
        		}
        		pds4_file_type = node.getNodeName();
        		if (debug) {
        			domUtils.serializeNode(node, xmlFileName, "xml");
        		}
        	}   		
    	}

    	/*************
    	// this must be xpath 1.0
    	// xPath = "//Product_Observational/File_Area_Observational/*[contains(node(),'Table_')]";
    	// xPath = "//File_Area_Observational/*[contains(node(),'Table_')]";
    	xPath = "//pds:File_Area_Observational/*[contains(node(),'Table_')]";
    	if (debug) {
        	System.out.println("xPath2 "+xPath);
    	}
    	node = domUtils.getSingleNode(doc,xPath, pdsNamespaceContext);   
    	if (debug) {
    		if (node != null) {
    			System.out.printf("xPath %s name=%s namespace = %s",xPath, node.getNodeName(), node.getNamespaceURI());
    			domUtils.serializeNode(node, "_XXX_pds-xpath2.xml", "xml");
    		}
        }
        ***********/
    	
    	// get the specific Table_ type
        
        return pds4_file_type;
        
    }

    /**************************************************************
    * Create a SystemLabel from the contents of the Document
    *
    * @param Document this is specific to a Document filled from a PDS image label
    * 
    *****/
    public SystemLabel  createSystemLabel(Document doc, NamespaceContext pdsNamespaceContext ) {
    	
    	if (debug) {
    		System.out.println("==================================================================");
    		System.out.println("*************** pds4InputFile.createSystemLabel ******************");
    		System.out.println("==================================================================");
    	}
    	
    	
    	

    
        DOMutils domUtils = new DOMutils();
        // avoid grabbing the IIO enabled version
        // DOMutils domUtils = new DOMutils();
        
        // use an ISIS system label since it has some extra elements specific
        // to PDS and ISIS images
        PDS4SystemLabel sys = new PDS4SystemLabel();
        
        String na = "\"N/A\"" ;
        String na2 = "N/A" ;
    
        String format = "BYTE"; // BYTE HALF FULL REAL DOUB COMP
        String data_type = "";
        String pds4_image_type = ""; // Array_2D_Image, Array_3D_Image
        String org = "BSQ"; // BSQ BIL BIP
        
        int nl = 0;
        int ns = 0;
        int nb = 1;
        int bits = 8; // Per sample
       
        String host = "JAVA";
        // String intFormat = "LOW";
        String intFormat = "HIGH";
        String realFormat = "VAX"; // this is the default
        boolean unsignedFlag = true;
        
        // PDS ISIS specific items
        
        
        double core_base = 0.0;
        double core_multiplier = 1.0;
        int core_valid_minimum = 0;
        int bandsToUse[] = {0,1,2};
        boolean isRGB = false;
        int bsb = 0; // band suffix bytes
        int lsb = 0; // line suffix bytes
        int ssb = 0; // sample suffix bytes
        int suffix_items[] = {0,0,0};
        
        int line_suffix_bytes = 0;
        int line_prefix_bytes = 0;
        
        int lpb = 0; // line prefix Bytes
        
        // get stuff out of the Document
        Node root = doc.getDocumentElement();
        Node result;
        Node fileAreaObsNode ;
        Node productObservationalNode ;
        String nodeValue;
        Node node, n;
        NodeIterator ni;
        String offset_str = "";
        int offset = 0;
        String offset_units = "";
        String array_type;
        String axes_str = "";
        int axes = 0; 
        int filesize_bytes = 0;
        // where can we get 
        int file_records = 0;
        String axis_index_order = "";
        Node node2D = null;
        Node node2D_S = null;
        Node node3D = null;
        Node node3D_S = null;
        String xPath2D, xPath3D, xPath3D_S, xPath2D_S;
        
        // if the file has no <Header> then 0 offset and length is correct
        // This is the header in the detached file
        // There can be multiple headers in a file. ODL3/vicar dualie is primary example
        int header_ct = 0;
        String[] header_offset_str =  new String[header_ct];
        int[] header_offset_bytes = {0};
        String[] header_offset_units = new String[header_ct];
        String[] header_object_length_str = new String[header_ct];
        int[] header_object_length_bytes = {0};
        String[] header_object_length_units = new String[header_ct];
        
        // these should be the same value as offset_str, offset_units
        String[] header_parsing_standard_id = {"RAW"}; // PDS3, VICAR, FITS, etc
        // if the label has NO <Header> object it means the data file is RAW and the offset is 0
        // set this based on value of PDSimageWriteParam.getReaderFormat();
    	
        	
        
        
    	String[] axis_name = new String[axes];
    	String[] elements = new String[axes];
    	String[] sequence_number = new String[axes];
    	
    	// String[] header_offset = 
        
    	if (debug) { 
    		domUtils.serializeNode(doc, "_createSystemLabel_doc.xml", "xml");
    	}
        
        String xPath = "/pds:Product_Observational" ;
        // this is the entire label - use to determine if it is an image??
        
        productObservationalNode = domUtils.getSingleNode(doc,xPath, pdsNamespaceContext);   
        if (debug) { // 
        	System.out.println("xPath "+xPath);
        	domUtils.serializeNode(productObservationalNode, "_pds-Product_Observational.xml", "xml");
        }
        
        
        xPath = "//pds:File_Area_Observational" ;
        // image file details are inside of this Element
        fileAreaObsNode = domUtils.getSingleNode(doc,xPath, pdsNamespaceContext);
        if (debug) {
        	System.out.println("xPath "+xPath);
        	domUtils.serializeNode(fileAreaObsNode, "_pds-File_Area_Observational.xml", "xml");
        }
        
        String xmlFileName = "";
    	for (int i=0 ; i< _pds4_table_types.length ; i++) {
    		if (debug) {
    			System.out.printf("_pds4_table_types[%d] = %s \n", i, _pds4_table_types[i]);
    		}
    		xPath = _pds4_table_types[i];
    		xmlFileName = "_XXX_pds4_table_types"+1+".xml";
            if (debug) {
            	System.out.println("findPDS4_file_type xPath "+xPath);
            }
        	node = domUtils.getSingleNode(doc,xPath, pdsNamespaceContext);   
        	
        	if (node != null) {
        		if (debug) {
        			System.out.printf("xPath %s name=%s \n",xPath, node.getNodeName());
        		}
        		_File_Area_Observational_type = node.getNodeName();
        		_pds4_fao_type = _File_Area_Observational_type;
        		if (debug) {
        			domUtils.serializeNode(node, xmlFileName, "xml");
        		}
        		break;
        	}   		
    	}
    	
    	if (_File_Area_Observational_type.equals("")) {
    		for (int i=0 ; i< _pds4_array_types.length ; i++) {
    			if (debug) {
    				System.out.printf("_pds4_array_types[%d] = %s \n", i, _pds4_array_types[i]);
    			}
        		xPath = _pds4_array_types[i];
        		xmlFileName = "_XXX_pds4_array_types"+1+".xml";
                if (debug) {
                	System.out.println("findPDS4_file_type xPath "+xPath);
                }
            	node = domUtils.getSingleNode(doc,xPath, pdsNamespaceContext);   
            	
            	if (node != null) {
            		if (debug) {
            			System.out.printf("xPath %s name=%s \n",xPath, node.getNodeName());
            		}
            		_File_Area_Observational_type = node.getNodeName();
            		pds4_image_type = _File_Area_Observational_type ;
            		if (debug) {
            			domUtils.serializeNode(node, xmlFileName, "xml");
            		}
            		break;
            	}   		
        	}
    		
    	}
        
    	
    	
        
        /**
        // determine if this is: //pds:Array_2D_Image, //pds:Array_3D_Image, //pds:Array_3D_Spectrum
        // then go to a case which handles that type
        xPath2D = "//pds:Array_2D_Image" ;
    	node2D = domUtils.getSingleNode(doc,xPath2D, pdsNamespaceContext);   
    	if (debug) {
        	System.out.println("xPath2D "+xPath2D);
        	domUtils.serializeNode(node2D, "_pds-Array_2D_Image.xml", "xml");
        }
    	
    	xPath3D = "//pds:Array_3D_Image" ;
    	node3D = domUtils.getSingleNode(doc,xPath3D, pdsNamespaceContext); 
    	if (debug) {
        	System.out.println("xPath3D "+xPath3D);
        	domUtils.serializeNode(node3D, "_pds-Array_3D_Image.xml", "xml");
        }
    	
    	xPath3D_S = "//pds:Array_3D_Spectrum" ;
    	node3D_S = domUtils.getSingleNode(doc,xPath3D_S, pdsNamespaceContext); 
    	if (debug) {
        	System.out.println("xPath3D_S"+xPath3D_S);
        	domUtils.serializeNode(node2D, "_pds-Array_3D_Spectrum.xml", "xml");
        }
    	
    	xPath2D_S = "//pds:Array_2D_Spectrum" ;
    	node2D_S = domUtils.getSingleNode(doc,xPath2D_S, pdsNamespaceContext); 
    	if (debug) {
        	System.out.println("xPath2D_S"+xPath2D_S);
        	domUtils.serializeNode(node2D, "_pds-Array_2D_Spectrum.xml", "xml");
        }
    	
    	// eventually there may be other types we learn how to read
    	// Array_2D_Map ???
    	// may also need to look for Display_2D_Image - this indicates direction data should be read
    	// bottom up like FITS 
    	    	
    	if (node2D != null) {
    		pds4_image_type = xPath2D.replace("//pds:", "");
    	} else if (node3D != null) {
    		pds4_image_type = xPath3D.replace("//pds:", "");
    	} else if (node3D_S != null) {
    		pds4_image_type = xPath3D_S.replace("//pds:", "");
    	} else if (node2D_S != null) {
    		pds4_image_type = xPath2D_S.replace("//pds:", "");
    	} else {
    		pds4_image_type = "unknown";
    	}
    	***/
        
    	if (debug) {
    		System.out.println("pds4_image_type "+pds4_image_type+"  _pds4_fao_type "+ _pds4_fao_type +"**************");
    		System.out.println("_File_Area_Observational_type "+_File_Area_Observational_type );
    	}
    	
    	sys.set_File_Area_Observational_type(_File_Area_Observational_type);
    	// get the rest of the values we need based on if this is Table or Array
    	if (_File_Area_Observational_type.contains("Table_")) {
    		// get the few Table things we need. Set defaults for everything else that
    		// will prevent us from throwing exceptions
    		xPath = "//pds:File/pds:file_name" ;
        	
        	nodeValue = domUtils.getNodeValue(fileAreaObsNode, xPath, pdsNamespaceContext);
        	
        	
        	detachedFilename = nodeValue;
        	if (debug) {
        		System.out.println("fileAreaObsNode "+fileAreaObsNode+", "+xPath+" >"+nodeValue+"< ");
        	}
    		
    		sys.setDetachedFilename(detachedFilename);
    	    
    		if (debug) {
    			System.out.println("Table_  ");
        		System.out.println("******************************************************** ");
        	}
    	    return sys;
    	}
    	
    	xPath = "//pds:Header";
    	// Header nodes are not required. No Headers indicates the data file is a RAW file
    	if (debug) {
    		System.out.println(xPath+"  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
    		System.out.println("#################################################");
    	}
    	NodeList headerNodes = domUtils.getNodeList(doc, xPath, pdsNamespaceContext);
    	
    	// loop thru these
    	header_ct = headerNodes.getLength();
    	    	
    	// allocate arrays
    	header_offset_str =  new String[header_ct];
        header_offset_bytes = new int[header_ct];
        header_offset_units = new String[header_ct];
        
        header_object_length_str = new String[header_ct];
        header_object_length_bytes = new int[header_ct];
        header_object_length_units = new String[header_ct];
        header_parsing_standard_id = new String[header_ct];
    	
    	for (int x=0 ;x < headerNodes.getLength() ; x++) {
 			Node hn = headerNodes.item(x);
 			String value = domUtils.getNodeValue(hn).trim();
 			String name = hn.getLocalName();
	  		if (debug) System.out.println(x+")  "+xPath+"  name="+name+"  value=>"+value+"<");
	  		// get the attribute ("unit")
	  		// get children and attributes
	  		String childXPath = "//pds:offset";
	  		Node childNode;
	  		
	  		childNode = domUtils.getSingleNode(hn, childXPath, pdsNamespaceContext);
        	if (childNode != null) {
        		value = domUtils.getNodeValue(childNode).trim();
        		header_offset_str[x] = value;
        		header_offset_bytes[x] = Integer.parseInt(value);
     			     			
        		Hashtable attrs = domUtils.getNodeAttributesHash(childNode);

        		header_offset_units[x] =  (String)  attrs.get("unit");
        		// bytes can only be "byte" - if it was osmething different
        		// header_offset_bytes[x] *= unut_bytes; 
        		
        	} else {
        		if (debug) { System.out.println("no attributes for "+xPath); }
        	}
        	
        	if (debug) {
        		System.out.println(x+"))  "+childXPath+" "+header_offset_str[x]+" "+header_offset_bytes[x]+"  "+header_offset_units[x]);
        	}
        	
        	
        	
        	childXPath = "//pds:object_length";
	  		
	  		childNode = domUtils.getSingleNode(hn, childXPath, pdsNamespaceContext);
        	if (childNode != null) {
        		value = domUtils.getNodeValue(childNode).trim();
        		header_object_length_str[x] = value;
        		header_object_length_bytes[x] = Integer.parseInt(value);
     			
        		Hashtable attrs = domUtils.getNodeAttributesHash(childNode);
        		header_object_length_units[x] =  (String)  attrs.get("unit");		
        		// bytes can only be "byte" - if it was something different
        		// header_object_length_bytes[x] *= unit_bytes; 
        		
        	} else {
        		if (debug) { System.out.println("no attributes for "+xPath); }
        	}
        	
        	if (debug) {
        		System.out.println(x+"))  "+childXPath+" "+header_object_length_str[x]+" "+header_object_length_bytes[x]+"  "+header_object_length_units[x]);
        	}
        	
        	childXPath = "//pds:parsing_standard_id";
	  		
	  		// if (debug) System.out.println(x+")  "+childXPath+" getSingleNode nn and attributes");
	  		childNode = domUtils.getSingleNode(hn, childXPath, pdsNamespaceContext);
        	if (childNode != null) {
        		value = domUtils.getNodeValue(childNode).trim();
        		header_parsing_standard_id[x] = value;       		
        	} else {
        		System.out.println("no attributes for "+xPath);
        	}
        	
        	if (debug) {       		
        		System.out.println(x+"))  "+childXPath+" "+header_parsing_standard_id[x]+" ");
        	}
    	 } // for loop thru the Headers
    	
    	/***
    	 * // boolean _flip_image_vertical = false;
        // boolean _flip_image_horizontal = false;
         * 
         *
    		  * <Display_2D_Image>
            		<line_display_direction>Down</line_display_direction>
            		<sample_display_direction>Right</sample_display_direction>
        		</Display_2D_Image>
        		// can we use this?? in the systemLabel (FITS is UP)
        		 // new - use this to set the flag for FITS display (or anything else)
        		 // jConvertIIO.flip_image - this is used to control a JAI operator
        		 // calls the JAI "transpose" operator 
        		<Discipline_Area>
            <disp:Display_Settings>
                <disp:Local_Internal_Reference>
                    <local_identifier_reference>Bob</local_identifier_reference>
                    <local_reference_type>display_settings_to_image</local_reference_type>
                </disp:Local_Internal_Reference>
                <disp:Display_Direction>
                    <disp:horizontal_display_axis>Sample</disp:horizontal_display_axis>
                    <disp:horizontal_display_direction>Left to Right</disp:horizontal_display_direction>
                    <disp:vertical_display_axis>Line</disp:vertical_display_axis>
                    <disp:vertical_display_direction>Bottom to Top</disp:vertical_display_direction>
                </disp:Display_Direction>
            </disp:Display_Settings>
        </Discipline_Area>
	// Valid values for horizontal_display_direction are "Left to Right" and "Right to Left". 
	 * For vertical_display_direction, valid values are "Bottom to Top" and "Top to Bottom".
     * - look at "jai "transpose" operator FLIP_VERTICAL FLIP_HORIZONTAL
     * "Left to Right   - do nothing
     * "Right to Left"  - FLIP_HORIZONTAL  ( become flop_image ??? )
     * "Bottom to Top"   - FLIP_VERTICAL (current flip_image use)
     * "Top to Bottom"   - do nothing
     * or becomes flip_image_vertical, flip_image_horizontal
    *************/
    	// locate this xpath <disp:Display_Settings>
    	xPath = "//disp:Display_Settings/disp:Display_Direction/disp:vertical_display_direction" ;
    	// make sure what we want is inside fileAreaObsNode
    	nodeValue = domUtils.getNodeValue(productObservationalNode, xPath, pdsNamespaceContext);
    	if (debug) System.out.println(" "+xPath+" >"+nodeValue+"< _flip_image_vertical "+_flip_image_vertical) ;
    	if (nodeValue != null) {
    		//  "Bottom to Top"   - FLIP_VERTICAL (current flip_image use)
    	     // "Top to Bottom"   - do nothing
    		// boolean 
            if (nodeValue.equals("Bottom to Top")) {
            	_flip_image_vertical = true;
            }
    	}
    	
    	xPath = "//disp:Display_Settings/disp:Display_Direction/disp:horizontal_display_direction" ;
    	
    	// make sure what we want is inside fileAreaObsNode
    	nodeValue = domUtils.getNodeValue(productObservationalNode, xPath, pdsNamespaceContext);
    	if (debug) System.out.println("productObservationalNode "+productObservationalNode+", "+xPath+" >"+nodeValue+"< ");
    	if (nodeValue != null) {
    		// use the value to set a flag
    		// "Left to Right   - do nothing
    	    // "Right to Left"  - FLIP_HORIZONTAL  ( become flop_image ??? )
    		// boolean flip_image_horizontal = false;
    		if (nodeValue.equals("Right to Left")) {
            	_flip_image_horizontal = true;
            }
    	}
    	
    	if (debug) System.out.println("  _flip_image_vertical "+_flip_image_vertical+"  _flip_image_horizontal "+_flip_image_horizontal) ;
   	
    	 if (pds4_image_type.startsWith("Array_2D") || pds4_image_type.startsWith("Array_3D")) {
            // if (pds4_image_type.equalsIgnoreCase("Array_2D_Image")) {

        	// xPath = "//pds:Array_2D_Image" ;
    		 xPath = "//pds:"+pds4_image_type ;
        	if (debug) {
            	System.out.println("xPath "+xPath);
        	}
        	nb = 1;
        	// if (debug) System.out.println("xPath "+xPath);
        	node = domUtils.getSingleNode(fileAreaObsNode,xPath, pdsNamespaceContext);    
        	
        	if (node != null) {
        		array_type = xPath.replace("//pds:", "");
        		// array_type = xPath.replace("//", "");
        		
        		if (debug) {
        			System.out.println("FOUND node "+node+", "+xPath+" ");
        			System.out.println("array_type "+array_type+" ");
        			domUtils.serializeNode(node, "_pds-"+pds4_image_type+".xml", "xml");
        		}
        		
        		// this offset is inside the Array_2D_Image - don't how this relates to Header/offset
        		xPath = "//pds:offset" ;
        		xPath = "//pds:"+pds4_image_type+"/pds:offset" ;
				offset_str = domUtils.getNodeValue(node, xPath, pdsNamespaceContext);
				offset = Integer.parseInt(offset_str);
				if (debug) {
					System.out.println(" "+xPath+" >"+offset_str+"< "+offset+" ");
				}
	        	// need to also get attribute unit
	        	// xPath = "//OBJECT[@name='IMAGE']/item[@key='LINE_SUFFIX_BYTES']" ;
	        	n = domUtils.getSingleNode(node, xPath, pdsNamespaceContext);
	        	if (n != null) {
	        		Hashtable attrs = domUtils.getNodeAttributesHash(n);
	        		if (debug) {
	        			System.out.println("attrs = " + attrs+"  size = "+attrs.size());
	        			Enumeration enumeration = attrs.elements();

	        			while (enumeration.hasMoreElements()) { // values
	        				System.out.println("hashtable values: " + enumeration.nextElement());
	        			}
	        			enumeration = attrs.keys();

	        			while (enumeration.hasMoreElements()) { // values
	        				System.out.println("hashtable keys: " + enumeration.nextElement());
	        			}
	        		}

	        		offset_units =  (String)  attrs.get("unit");
	        		if (debug) {
	        			System.out.println("offset_units = " + offset_units);
	        		}
	        		
	        	} else {
	        		if (debug) {
	        			System.out.println("no attributes");
	        		}
	        	}
	        	
	        	
	        	
	            // how do I make it [3] ??
	            axes = 0;
	        	
	        	xPath = "//pds:axis_index_order" ;
				nodeValue = domUtils.getNodeValue(node, xPath, pdsNamespaceContext);
				if (debug) {
					System.out.println(" "+xPath+" >"+nodeValue+"< ");
				}
	        	axis_index_order = nodeValue;
	        	
	            
	        	
        		xPath = "//pds:axes" ;
				nodeValue = domUtils.getNodeValue(node, xPath, pdsNamespaceContext);
				if (debug) {
					System.out.println(" "+xPath+" >"+nodeValue+"< ");
				}
	        	axes_str = nodeValue;
	        	axes = Integer.parseInt(axes_str);
	        	// if we are in Array_2D_Image this should always be 2
	        	axis_name = new String[axes];
	        	elements = new String[axes];
	        	sequence_number = new String[axes];
	        	
	        	
        		xPath = "//pds:Axis_Array/pds:axis_name" ;
				String[] nodeValues = domUtils.getNodeValues(node, xPath, pdsNamespaceContext);
				if (debug) {
					System.out.println("getNodelValues "+nodeValues.length+"   "+xPath+" >"+nodeValues+"< ");
				}
	        	for (int ii = 0; ii < nodeValues.length ; ii++ ) {
	        		if (debug) { System.out.println(ii+") "+nodeValues[ii]);}
	        		axis_name[ii] = nodeValues[ii];
	        	}
	        	
	        	xPath = "//pds:Axis_Array/pds:elements" ;
				nodeValues = domUtils.getNodeValues(node, xPath, pdsNamespaceContext);
				if (debug) {
					System.out.println("getNodelValues "+nodeValues.length+"   "+xPath+" >"+nodeValues+"< ");
				}
	        	for (int ii = 0; ii < nodeValues.length ; ii++ ) {
	        		if (debug) { System.out.println(ii+") "+nodeValues[ii]); }
	        		elements[ii] = nodeValues[ii];
	        	}
	        	
	        	xPath = "//pds:Axis_Array/pds:sequence_number" ;
				nodeValues = domUtils.getNodeValues(node, xPath, pdsNamespaceContext);
				if (debug) {
					System.out.println("getNodelValues "+nodeValues.length+"   "+xPath+" >"+nodeValues+"< ");
				}
	        	for (int ii = 0; ii < nodeValues.length ; ii++ ) {
	        		if (debug) { System.out.println(ii+") "+nodeValues[ii]); }
	        		sequence_number[ii] = nodeValues[ii];
	        	}
	        	
	        	// now we have all the values. Use them to set the values we need
	        	for (int ii = 0; ii < nodeValues.length ; ii++ ) {
	        		// System.out.println(ii+") "+axis_name_values[ii]+" "+sequence_number_values[ii]+" "+elements_values[ii]);
	        		
	        		if (debug) { 
	        			System.out.println(ii+") "+axis_name[ii]+" "+sequence_number[ii]+" "+elements[ii]);
	        		}
	        		if (axis_name[ii].equalsIgnoreCase("Line")) {
	        			nl = Integer.parseInt(elements[ii]);
	        		} else if (axis_name[ii].equalsIgnoreCase("Sample")) {
	        			ns = Integer.parseInt(elements[ii]);
	        		} else if (axis_name[ii].equalsIgnoreCase("Band")) {
	        			nb = Integer.parseInt(elements[ii]);
	        			// we will never see this in Array_2D_Image
	        		}
	        		// for now assume sequence_number[ii] is not useful
	        	}
	        	// does Array_3D_Image add another axis (bands??)
    		
        	} else {
        		   
            	if (debug) System.out.println("ERROR "+pds4_image_type +" node "+node+", "+xPath+" ");
            	       		
        	}
        	
        	xPath = "//pds:File/pds:file_name" ;
        	// if (debug) System.out.println("xPath "+xPath);
        	// 
        	// nodeValue = domUtils.getItemValue(fileAreaObsNode, xPath);
        	nodeValue = domUtils.getNodeValue(fileAreaObsNode, xPath, pdsNamespaceContext);
        	// getNodeValue ??? does getIOtemValue assume this is an Item element whose name is String??
        	// nodeValue = domUtils.getItemValue(fileAreaObsNode, xPath, pdsNamespaceContext);
        	if (debug) System.out.println("fileAreaObsNode "+fileAreaObsNode+", "+xPath+" >"+nodeValue+"< ");
        	detachedFilename = nodeValue;
        	
        	xPath = "//pds:File/pds:records" ;
        	nodeValue = domUtils.getNodeValue(fileAreaObsNode, xPath, pdsNamespaceContext);
        	if (debug) System.out.println("fileAreaObsNode "+fileAreaObsNode+", "+xPath+" >"+nodeValue+"< ");
        	if (nodeValue != null) {
        		file_records = Integer.parseInt(nodeValue);
        	}
        	
        	xPath = "//pds:File/pds:file_size" ;
        	nodeValue = domUtils.getNodeValue(fileAreaObsNode, xPath, pdsNamespaceContext);
        	if (debug) System.out.println("fileAreaObsNode "+fileAreaObsNode+", "+xPath+" >"+nodeValue+"< ");
        	if (nodeValue != null) {
        		filesize_bytes = Integer.parseInt(nodeValue);
        	}
        	
        	// put this inside 2D or 3D ??
        	xPath = "//pds:data_type" ;
        	// nodeValue = domUtils.getItemValue(fileAreaObsNode, xPath);
        	nodeValue = domUtils.getNodeValue(fileAreaObsNode, xPath, pdsNamespaceContext);
        	if (debug) System.out.println("fileAreaObsNode "+fileAreaObsNode+", "+xPath+" >"+nodeValue+"< ");
        	data_type = nodeValue;
        	
        	xPath = "//pds:scaling_factor" ;
        	nodeValue = domUtils.getNodeValue(fileAreaObsNode, xPath, pdsNamespaceContext);
        	if (debug) System.out.println("fileAreaObsNode "+fileAreaObsNode+", "+xPath+" >"+nodeValue+"< ");
        	if (nodeValue == null) {
        		core_multiplier = 1.0;
        	} else { 
        		core_multiplier = Double.parseDouble(nodeValue);
        	}
        	
        	xPath = "//pds:value_offset" ;
        	nodeValue = domUtils.getNodeValue(fileAreaObsNode, xPath, pdsNamespaceContext);
        	if (debug) System.out.println("fileAreaObsNode "+fileAreaObsNode+", "+xPath+" >"+nodeValue+"< ");
        	if (nodeValue == null) {
        		core_base = 1.0;
        	} else { 
        		core_base = Double.parseDouble(nodeValue);
        	}
        	
        	// get items that are only found in specific Array-?? types here
        	
        	        	
        	if (debug) {
        		// add local identifier object
        		// get values from the 3D arrays
        		System.out.println("pds4_image_type    			"+pds4_image_type);
        		       		
        		System.out.println("offset_str 				"+offset_str );
        		System.out.println("offset 					"+offset );
        		
        		System.out.println("header_ct 				"+header_ct );
        		for (int j = 0; j < header_ct ; j++) {
        			System.out.println("header_offset_str 			"+header_offset_str[j]);
        			System.out.println("header_offset_bytes			"+header_offset_bytes[j]);
        			System.out.println("header_offset_units 			"+header_offset_units[j]);
        			System.out.println("header_object_length_str 		"+header_object_length_str[j]);
        			System.out.println("header_object_length_bytes		"+header_object_length_bytes[j]);
        			System.out.println("header_object_length_units		"+header_object_length_units[j]);       		
        			System.out.println("header_parsing_standard_id		"+header_parsing_standard_id[j]);
        			System.out.println("header_offset_bytes			"+header_offset_bytes[j]);
        		}
        		
        		System.out.println("axis_index_order			"+axis_index_order);
        		System.out.println("axes_str 				"+axes_str);
        		System.out.println("axes 					"+axes);
        		
        		// Header
        		// 
        		System.out.println("detachedFilename			"+detachedFilename);
        		System.out.println("data_type				"+data_type);
        			
        		System.out.println("core_multiplier				"+core_multiplier);
        		System.out.println("core_base				"+core_base);
        		System.out.println("org					"+org);
        		System.out.println("nl = "+nl+"  ns = "+ns+"  nb = "+nb);
        		
        		System.out.println("filesize_bytes			"+filesize_bytes);
        		System.out.println("file_records			"+file_records);
        		
        		System.out.println("_flip_image_horizontal "+_flip_image_horizontal);
        		System.out.println("_flip_image_vertical "+_flip_image_vertical);
        		
        		for (int ii = 0; ii < axes ; ii++ ) {
	        		// System.out.println(ii+") "+axis_name_values[ii]+" "+sequence_number_values[ii]+" "+elements_values[ii]);	        		
	        		System.out.println(ii+") "+axis_name[ii]+" "+sequence_number[ii]+" "+elements[ii]);		
        		}
        	}     
        	
        } else if (pds4_image_type.equalsIgnoreCase("Array_3D_Image")) {	
        	xPath = "//pds:Array_3D_Image" ;
        	if (debug) {
            	System.out.println("xPath "+xPath);
        	}
        	
        	node = domUtils.getSingleNode(fileAreaObsNode,xPath, pdsNamespaceContext);    
        	if (node != null) {
        	
        	}
        	
        } else if (pds4_image_type.equalsIgnoreCase("Array_3D_Spectrum")) {	
        	xPath = "//pds:Array_3D_Spectrum" ;
        	if (debug) {
            	System.out.println("xPath "+xPath);
        	}
        	
        	node = domUtils.getSingleNode(fileAreaObsNode,xPath, pdsNamespaceContext);    
        	if (node != null) {
        	
        	}
        } else {
        	
        	// currently an error, eventually there may be something else we look for
        	// punt
        	System.out.println("PDS4InputFile ERROR. No supported data format found. File cannot be read.");
        	 return (SystemLabel) null;
        }
        
        // print values we have now
        // nsl, ns, nb, detachedFilename, core_multiplier, core_base, pds4_image_type, 
        // axis_index_order, offset
        
        
        
        // get root/result do next search on that
        
        // check for "Display_2D_Image" or "Display_3D_Image"
            
        // first verify that this is the correct Document type
        
        // PDSMetadata.nativeMetadataFormatName
        
        // result = XPathAPI.selectSingleNode(root, PDSMetadata.nativeMetadataFormatName);
        // String xPath = "//"+PDSMetadata.nativeMetadataFormatName ;
        // remove dependancy on ImageIO
        // String nativeMetadataFormatName = "PDS4_LABEL";
        String nativeMetadataFormatName = "pds:Product_Observational";
        //  String 
        xPath = "//"+nativeMetadataFormatName ;
        if (debug) System.out.println("PDS4InputFile.createSystemLabel() " +xPath);
       
        // result = domUtils.getResultNode(root,xPath, pdsNamespaceContext);
        result = domUtils.getSingleNode(doc,xPath, pdsNamespaceContext);  
        // String nodeValue = getItemValue(root, xPath);
        // get the needed data from the result node
        if (debug) {
        	System.out.println("result) " +result);
        	
        	// serialize to a DOM. put this into the metadata object
        	domUtils.serializeNode(result, "_PDS4_result.xml", "xml");
        }
        if (result == null) {
            if (debug) System.out.println("PDSInputFile.createSystemLabel() incompatable Document");
            return (SystemLabel) null;
        }
          
        if (debug) {
        	System.out.println("###### end createSystemLabel for "+pds4_image_type+"    ###############\n");
        }
        
        // debug = d;
        // domUtils.setDebug(d);
        
        // sys.setBandsToUse(bandsToUse);
        //    sys.setBSB(bsb);
        //    sys.setLSB(lsb);
        //    sys.setSSB(ssb);
        //    sys.setCore_base(core_base);
        //    sys.setCore_multiplier(core_multiplier);
            
        //    sys.setLPB(lpb);
        sys.setLinePrefixBytes(line_prefix_bytes);
        sys.setLineSuffixBytes(line_suffix_bytes);
    
     
    if (header_ct != 0) {
    	sys.setHeader_object_length_bytes(header_object_length_bytes);
    	sys.setHeader_offset_bytes(header_offset_bytes) ; // offset_bytes. should be set    
    	sys.setParsing_standard_id(header_parsing_standard_id) ;
    }
    
    sys.setOffset_bytes(offset) ; // offset_bytes. should be set 
    sys.setFile_records(file_records);
    sys.setFilesize_bytes(filesize_bytes);

    // sys.setIntFmt(s)
    // sys.setBRealFmt()
    
    // based on all the information we have gathered set values into the system label
    sys.setLinePrefixBytes(line_prefix_bytes);
    sys.setLineSuffixBytes(line_suffix_bytes);
    sys.setOrg(org); // BSQ BIL BIP
    // org is needed before these so N1 N2 N3 will be set correctly
    sys.setNL(nl);
    sys.setNS(ns);
    sys.setNB(nb);
    sys.setNBB(line_prefix_bytes);
    
    // USHORT  was added to support PDS, vicar doesn't have USHORT - HALF is signed
    
       
    sys.setHost(host) ; // JAVA is default
    // usignedFlag is not used anywhere
    
    // this one sets the correct values for sys.setFormat(), sys.setIntFmt(), sys.setRealFmt(realFormat);
    sys.setData_type(data_type);

    /******* don't set these here/
     * where are they set????????
    sys.setFormat(format); // BYTE HALF FULL REAL DOUB COMP USHORT
    // host IS ACTUALLY NOT USED .. this is the important one
    sys.setIntFmt(intFormat ) ;// LOW default , HIGH
    sys.setRealFmt(realFormat);
    *****/
    
    sys.setDetachedFilename(detachedFilename);
    
    sys.setCore_base(core_base);
    sys.setCore_multiplier(core_multiplier);
    
    // boolean flip_image_vertical = false;
    // boolean flip_image_horizontal = false;
    sys.setFlip_image_horizontal(_flip_image_horizontal);
    sys.setFlip_image_vertical(_flip_image_vertical);

    return sys;
    }
    
	
    /***************************************************************
    * convert a text item which is a list to an array of the values 
    * in the list
    * Assumes the item may have () parens around it and the list is comma seperated
    * allow for space in the items but don't copy the spaces
    ***********/
    private String[] getItemStringArray ( String array )  {
        
        array = array.substring ( array.indexOf ( "(" ) + 1, array.indexOf ( ")" ) );
        array.replace ( '"', ' ' );
        StringTokenizer st = new StringTokenizer ( array, "," );
        int i = 0;
        String[] stringArray = new String[st.countTokens()];
    
        while ( st.hasMoreTokens()  )  {
            stringArray[i] = new String ( st.nextToken().trim() );
            i++;
        }
        return stringArray;
    }
    
    
    private int[] getItemIntArray ( String array )  {
        
        if (debug) System.out.println("getItemIntArray "+array);
        int start = array.indexOf ( "(" );
        int end = array.indexOf ( ")" );
        if (debug) System.out.println(" start="+start+"  end="+end);
        if (start == -1 || end == -1) { 
            int[] intArray = new int[0];
            // return intArray;
            return null;
            }
        
        array = array.substring ( start + 1, end );
        StringTokenizer st = new StringTokenizer ( array, "," );
        int i = 0;
        int[] intArray = new int[st.countTokens()];
    
        while ( st.hasMoreTokens()  )  {
            intArray[i] = new Integer ( st.nextToken() ).intValue();
            i++;
        }
        return intArray;
    }
    
    private double[] getItemDoubleArray ( String array )  {
        
        if (debug) System.out.println("getItemIntArray "+array);
        int start = array.indexOf ( "(" );
        int end = array.indexOf ( ")" );
        if (debug) System.out.println(" start="+start+"  end="+end);
        if (start == -1 || end == -1) { 
            double[] doubleArray = new double[0];
            // return intArray;
            return null;
            }
        
        array = array.substring ( start + 1, end );
        StringTokenizer st = new StringTokenizer ( array, "," );
        int i = 0;
        double[] doubleArray = new double[st.countTokens()];
    
        while ( st.hasMoreTokens()  )  {
            doubleArray[i] = new Double ( st.nextToken() ).doubleValue();
            // float version would use
            // intArray[i] = new Double ( st.nextToken() ).floatValue();
            i++;
        }
        return doubleArray;
    }
    

    /**
    *
    * @return the Document derived from the PDS label
    */
    public Document getPDS4Document() {
            return _PDS_document;
    }
    
    /**
    *
    * @return the Document derived from the embedded vicar label
    */
    public Document getVicarDocument() {
            return _Vicar_document;
    }

    /**
    Function hasEmbeddedVicarLabel(). <p>
    <pre>
    public boolean hasEmbeddedVicarLabel() {
        if (_embeddedVicarLabel != null) {
	        return true;
	    }
	    else {
	        return false;
	    }
    }
    </pre>
    **/
    public boolean getHasEmbeddedVicarLabel() {
        return _hasEmbeddedVicarLabel;
    }
 
    /**
    * 
    * This is specific to a Document filled from a PDS image label
    * calculate the size of the image's label in bytes. This is how much must 
    * be skipped to start reading image data.
    * This method use the XPathAPI to search a Document for a Node.
    * if we get back a node then we extract a value.
    **/ 
    // public int  getLabelsize(Document doc) {
    
    public int getImageStart(Document doc, NamespaceContext pdsNamespaceContext) {
        
    	// debug = true;
        // jpl.mipl.util.DOMutils domUtils = new jpl.mipl.util.DOMutils();
        DOMutils domUtils = new DOMutils();
        SystemLabel sys = new SystemLabel();
        // Perl5Util perl = new Perl5Util();
    
        int imageStart = 0;
        int record_bytes = 0;
        int image_starting_record = 0;
        
        String value = "";
        String units = "";
        
        // get stuff out of the Document
        Node root = doc.getDocumentElement();
        Node result;
        String nodeValue, nodeKey;
        NodeList nl;
        String xPath = null;
        
        
        // first verify that this is the correct Document type
        // This may go away, I'm not sure I want to include this in the document
        
        // PDSMetadata.nativeMetadataFormatName
        // xPath = "//"+PDSMetadata.nativeMetadataFormatName ;
        String nativeMetadataFormatName = "PDS_LABEL"; // put this in the PDSCodec ???
        xPath = "//"+nativeMetadataFormatName ;
        // nodeValue = getItemValue(root, xPath);
        result = domUtils.getResultNode(root, xPath );
        // get the needed data from the result node
        if (result == null) {
            System.out.println("PDSInputFile.getLabelSize() incompatable Document");
            return 0;
        }
    
        
        xPath = "//item[@key='RECORD_BYTES']" ;
        nodeValue = domUtils.getItemValue(root, xPath);
        
        try {
        record_bytes = Integer.parseInt(nodeValue);
        } catch (NumberFormatException  nfe) {        
           System.out.println("NumberFormatException "+nfe);
           System.out.println("no value found for "+xPath);
           record_bytes = 0;
        }
        if (debug) {
        	System.out.println("PDSInputFile.getLabelSize() RECORD_BYTES="+nodeValue);
        	domUtils.serializeDocument( _PDS_document, "PDS_label.xml", "xml");
    	}
    	
        
        // ---------------
        Node node = domUtils.getSingleNode(_PDS_document,"//item[@key='^IMAGE']");
        _hasEmbeddedVicarLabel = false;
        if (debug) {
        	System.out.println("  find single node for ^IMAGE "+node);
        	domUtils.serializeNode( node, "IMAGE_node.xml", "xml");
        }
        
        if (node != null) {
            if (debug) System.out.println("   getImageStart() getting value ");
            imageStart = -1;
            value = domUtils.getNodeValue(node);
            
            if (debug) 
             System.out.println(" ^IMAGE ************  value >"+value+"< **************");
            // value may be in the attributes also -- above method finds the value in either spot
            if (value != null && !value.isEmpty()) {
            	if (debug) 
                    System.out.println(" ^IMAGE #################  value >"+value+"<");
            	// the value may be complicated
            	// look for something of the form ("filename.pds",27)
            	// the 27 is the start record of the image data
            	int commaPos = value.indexOf(",");
            	if (commaPos != -1) {
            		
            		String[] sv = value.split("/,/");
            		// value =  (String) v.elementAt(1);
            		value = sv[1];
            		
            		value = value.replaceAll("/\\s*/","");
            		value = value.replaceAll("/\\)/","");
            		// this value might also be like the one below and contain <BYTES> in it
            		// image_starting_record = Integer.parseInt(value);
            	} 
            }
            else {
            	if (debug) System.out.println("^IMAGE *********************** look for subitems");
            	// value may be in subitems
            	
            	xPath = "//item[@key='^IMAGE']/subitem[@key='^IMAGE']";
            	  
            	 // xPath = "//subitem[@key='^IMAGE']" ;
            	 String subitemValue = null;
            	 Node n;
            	 int ii=0;
            	 
            	 /*******
            	  * nodeIterator is broken ???
            	 Vector imageSubitemVec = new Vector();
            	 NodeIterator  ni = domUtils.getNodeIterator(root, xPath);
            	 // NodeIterator  ni = domUtils.getNodeIterator(node, xPath);
            	 
            	 // create a 
            	 ii=0;
            	 while ((n = ni.nextNode())!= null) {
            	  		
            	 	// subitemValue = domUtils.getSubitemValue(root, xPath);
            	  		subitemValue = domUtils.getNodeValue(n);
            	  		if (debug) System.out.println("^IMAGE ["+ii+"]  subitemValue=>"+subitemValue+"<");
            	  		imageSubitemVec2.add(subitemValue);
            	  		ii++;
            	  }
            	  *****/
            	 
            	 // test nodeList 
            	 Vector imageSubitemVec = new Vector();
            	 NodeList inList = domUtils.getNodeList(root, xPath);
            	 ii=0;
            	 for (int x=0 ;x < inList.getLength() ; x++) {
         			n = inList.item(x);
         			subitemValue = domUtils.getNodeValue(n);
        	  		if (debug) System.out.println("^IMAGE ["+ii+"]  subitemValue=>"+subitemValue+"<");
        	  		imageSubitemVec.add(subitemValue);
        	  		ii++;
            	 }
            	 
                 int vLen =   imageSubitemVec.size();
                 value="";
                 if (vLen == 0) {
                 	if (debug) System.out.println("^IMAGE   has no subitems !");
                 } else if (vLen == 1) {
                 	if (debug) System.out.println("^IMAGE   has 1 subitems !");
                 	// assume it is the offset?? but it could be the filename??
                 	// we should never get here since there wouldn't be a subitem
                 	// it would just be the value of the item
                 } else if (vLen == 2) {
                 	if (debug) System.out.println("^IMAGE   has 2 subitems !");
                 	// assume filename first, offset 2nd
                 	detachedFilename = (String)imageSubitemVec.get(0);
                 	detachedLabel = true;
                 	// offset may contain <BYTES>
                 	value = (String) imageSubitemVec.get(1);
                 	if (debug) System.out.println("^IMAGE  detachedFilename="+detachedFilename+"  value="+value);
                 } else {
                 	if (debug) System.out.println("^IMAGE   has "+vLen+" subitems !");
                 }
            	             	 
            }
            	
            if (debug) System.out.println("^IMAGE   value="+value+"< $$$$$$$$$$$$$$$$$$$$$$$$$$$");
            
              if (value.indexOf ("<BYTES>") != -1) {
              		if (debug) System.out.println("<BYTES>   v="+value+"~");
            		String v = value.replaceAll("<BYTES>",""); // remove <BYTES>
            		v = v.trim();
            		if (debug)System.out.println("<BYTES>   v="+v+"~");
            		imageStart = Integer.parseInt(v);
            		imageStart--; // header value is really the first byte of data, not the amount to skip to begin reading
            		if (debug) System.out.println("<BYTES>   imageStart="+imageStart );
            	}
            	else if (value.indexOf ("<RECORDS>") != -1) {
            		String v = value.replaceAll("<RECORDS>",""); // remove <RECORD>
            		if (debug) System.out.println("<RECORDS>   v="+v+"~");
            		v = v.trim();
            		
            		image_starting_record = Integer.parseInt(v);
            	}
            	else {
            		// assume the value here is records <RECORDS>
            		if (debug) System.out.println("value "+value+"  "+value.trim()+" *******************");
            		 image_starting_record = Integer.parseInt(value.trim());
            	}
            	       
          //  }
        
                  
            if (imageStart == -1) {
           		 imageStart = (image_starting_record - 1) * record_bytes;      		 
            } 
            else {
            	// calculate image_starting_record just as a check
            	image_starting_record = ( imageStart - 1) /record_bytes;
            }
            
            if (imageStart < 0) {
            	imageStart = 0;           
            }
            
            if (debug) {
                System.out.println(" image_starting_record "+image_starting_record); 
                System.out.println(" record_bytes "+record_bytes); 
                System.out.println(" imageStart "+imageStart);         
                System.out.println(" walk thru attributes hashtable"); 
                System.out.println(" calling domUtils.getNodeAttributesHash("+node+")"); 
            }
         
           if (node == null) {
        	   if (debug) System.out.println(" *** node is null,  attrs is null *******");
        	   image_starting_record = 0;
        	   imageStart = 0;
           } else {
           
            
         // find out if the imageHeader value is in BYTES or RECORDS
            Hashtable attrs = domUtils.getNodeAttributesHash(node);
            
            if (attrs != null) 
                {
                if (debug) System.out.println(" *** attrs isn't null *******");
                String v = (String) attrs.get("value"); // try capitalized too ???
                if (v != null) { // value may be a real value, not in an attribute
                    value = v;
                    image_starting_record = Integer.parseInt(value);
                }
                units = (String) attrs.get("units"); // try capitalized too ???
                if (debug) System.out.println(" *** value="+value+"   units="+units); 
            
                String file = (String) attrs.get("file"); // try capitalized too ???
                if (debug) System.out.println("^IMAGE file="+file);
            
                if (units != null) { // found "units" in attributes
                    if (units.equalsIgnoreCase("BYTES") ) {
                        // byte value is first byte of data
                        imageStart = image_starting_record - 1 ;
                    }
                    else if (units.equalsIgnoreCase("RECORDS") ) {
                        imageStart = (image_starting_record -1) * record_bytes;
                    }
                }
             }
           } 
        }
        else { // node == null   now try QUBE and SPECTRAL_QUBE
            node = domUtils.getSingleNode(_PDS_document,"//item[@key='^SPECTRAL_QUBE']");
            _hasEmbeddedVicarLabel = false;
            if (debug) System.out.println("  find single node for ^SPECTRAL_QUBE "+node);
            if (node != null) {
                if (debug) System.out.println("   getImageStart() getting value ^SPECTRAL_QUBE");
                value = domUtils.getNodeValue(node);
                if (debug) System.out.println("   value "+value);
                // value may be in the attributes also -- above method finds the value in either spot
                if (value != null) {
                    image_starting_record = Integer.parseInt(value);
                }
                imageStart = (image_starting_record - 1) * record_bytes ;
            }
            else {
                node = domUtils.getSingleNode(_PDS_document,"//item[@key='^QUBE']");
                _hasEmbeddedVicarLabel = false;
                if (debug) System.out.println("  find single node for ^QUBE "+node);
                if (node != null) {
                    if (debug) System.out.println("   getImageStart() getting value ");
                    value = domUtils.getNodeValue(node);
                    if (debug) System.out.println("   value "+value);
                    // value may be in the attributes also -- above method finds the value in either spot
                    if (value != null) {
                        image_starting_record = Integer.parseInt(value);
                    }
                imageStart = (image_starting_record - 1) * record_bytes;
                }
            }
        }
       

    if (debug) {
    	System.out.println("*****   PDSInputFile.getImageStart() imageStart="+imageStart);
    	System.out.println("image_starting_record="+image_starting_record);
    }
        
    return imageStart;
    }


	/**
	 * get a String for the PDS SAMPLE_TYPE based on the values set in
	 * int  vicarPixelSize = 0;
    String vicarFormat = null;
    String vicarIntFmt = null;
    String vicarRealFmt = null;
	 * @param _embed
	 */
    /***
	public String getPDS_SAMPLE_TYPE() {
	// vicarPixelSize = 0;
    String SAMPLE_TYPE = null;
    
		if (vicarFormat == null) {
			return SAMPLE_TYPE;
		} else if (vicarFormat.equalsIgnoreCase("BYTE")) {
			
		} else if (vicarFormat.equalsIgnoreCase("HALF")) {
			
		} else if (vicarFormat.equalsIgnoreCase("FULL")) {
			
		} else if (vicarFormat.equalsIgnoreCase("REAL")) {
			
		} else if (vicarFormat.equalsIgnoreCase("DOUB")) {
		}
			
		
		
	return SAMPLE_TYPE;
    // String vicarIntFmt = null;
    // String vicarRealFmt = null;
	}
	***/
	
	/**
	 * get a String for the PDS SAMPLE_TYPE based on the values set in
	 * int  vicarPixelSize = 0;
    String vicarFormat = null;
    String vicarIntFmt = null;
    String vicarRealFmt = null;
	 * @param _embed
	 */
    /***
	public int getPDS_SAMPLE_BITS() {
	// vicarPixelSize = 0;
    int SAMPLE_BITS = 0;
    
		if (vicarFormat == null) {
			return SAMPLE_BITS;
		} else if (vicarFormat.equalsIgnoreCase("BYTE")) {
			
		} else if (vicarFormat.equalsIgnoreCase("HALF")) {
			
		} else if (vicarFormat.equalsIgnoreCase("FULL")) {
			
		} else if (vicarFormat.equalsIgnoreCase("REAL")) {
			
		} else if (vicarFormat.equalsIgnoreCase("DOUB")) {
		}
			
		
		
	return SAMPLE_BITS;
    // String vicarIntFmt = null;
    // String vicarRealFmt = null;
	}
	***/
	// ---------------------------------
	


////////////////////////////////////////////////////////////////////////


/***********************************************************************
 * Internal routine for calculating the position to seek to given the
 * record address (n2/n3) and the offset within the record.  The binary
 * headers and prefixes are taken into account, i.e. position 0 is the first
 * pixel of the record (past the prefix), and line/band 0 is the first
 * line/band of pixel data (past the headers).
 * @throws IOException if start, n2 or n3 exceed the bounds of the image
 */
    protected long calcFilePos(int start, int n2, int n3) throws IOException
    {
        if (debug) {
        	/*
        System.out.print("PDSInputFile.calcFilePos: "+_system.getOrg());
		System.out.print(" NBB="+_system.getNBB()+" _line_prefix_bytes=" +_line_prefix_bytes);
        System.out.print(" start="+start+" N1="+_system.getN1() );
        System.out.print(" n2="+n2+" N2="+_system.getN2() );
        System.out.print(" n3="+n3+" N3="+_system.getN3() );
        System.out.println(" pixelSize="+_system.getPixelSize() );
        */
        }
    // where do we add band and line suffixs in???
    // getPixelSize() takes byte suffix into account
	if (start < 0 || start >= _system.getN1())
	    throw new IOException(
		"Attempt to read past edge of image for dimension 1: N1=" +
		_system.getN1() + ", read position=" + start);
	if (n2 < 0 || n2 >= _system.getN2())
	    throw new IOException(
		"Attempt to read past edge of image for dimension 2: N2=" +
		_system.getN2() + ", read position=" + n2);
	if (n3 < 0 || n3 >= _system.getN3())
	    throw new IOException(
		"Attempt to read past edge of image for dimension 3: N3=" +
		_system.getN3() + ", read position=" + n3);

	long filePos = _lblsize_front +
		(_system.getNLB() + (long)n3 * _system.getN2() + (long)n2)
							* _system.getRecsize() +
		(long)start * _system.getPixelSize() +
		_system.getNBB();
	
		// System.out.print("PDSInputFile.calcFilePos: "+filePos);
		
		// add suffixs in to set the file postion correctly
	int org_code = _system.getOrgCode();
	int suffix = 0; 
	int prefix = 0;
	int samples = 0;
	int lines = 0;
	int bands = 0;
    switch (org_code) {

	    case SystemLabel.ORG_BSQ:
	        // (SAMPLE,LINE,BAND)
	        // calculate suffix
	        // start is x (sample) 
	        // n2 is current line number
	        // n3 is current band number
	        samples = _system.getN1();
	        lines = _system.getN2();
	        bands = _system.getN3();
	        
	        
	        
	        // if (start == 0) {
	        suffix = _line_prefix_bytes ;
	        // }
	        // add prefix for current line ??
	        // System.out.println("calFilePos.BSQ _lblsize_front "+_lblsize_front+" start="+start+" n2="+n2+" n3="+n3+" suffix="+suffix+" filePos="+filePos);
	        
	    break;
	    
	    case SystemLabel.ORG_BIP:
	        // (BAND,SAMPLE,LINE)
	        // calculate suffix
	        // start is current band
	        // n2 is current sample number
	        // n3 is current line number
	        bands = _system.getN1();
	        samples = _system.getN2();
	        lines = _system.getN3();
	        
	        suffix = 0;	        	        
	        
	        suffix +=_line_prefix_bytes;
	        
	        // each line contains all bands
	        /**
	        if ( n2 == 0 || n2 == 299 || (n3 % 100 == 0 && n2 %100 == 0) || (n3 % 100 == 1 && n2 %100 == 1)) {
	          System.out.print("BIP start="+start+" samp="+samples+" bands="+bands+" lines="+lines+" s-n2="+n2);
	          System.out.println(" l-n3="+n3+" _ssb="+_ssb+" _bsb="+_bsb+" suff="+suffix );
	        } **/
	        
	    break;
	    
	    case SystemLabel.ORG_BIL:
	        // (SAMPLE,BAND,LINE)
	        // start is current sample
	        // n2 is current band number
	        // n3 is current line number
	        samples = _system.getN1();
	        bands = _system.getN2();
	        lines = _system.getN3();
	        
	        // start is current sample
	        // n2 is current band number
	        // n3 is current line number 
	        suffix = 0;
	        
	        suffix +=_line_prefix_bytes;
	        /**
	        if (n3 % 100 == 0 && n2 %100 == 0) {
	          System.out.print("BIL start="+start+" lines="+lines+" n2="+n2+" n3="+n3+" _ssb="+_ssb );
	          System.out.println(" _bsb="+_bsb+" bands="+bands+" suffix="+suffix );
	        } **/
	    break;
    }	
		
	// nbb is now set which is the same as _line_prefix_bytes	
	// filePos += (long) suffix;	
	
	/***
	if ( n2 == 0 || n2 == 299 || (n3 % 100 == 0 && n2 %100 == 0) || (n3 % 100 == 1 && n2 %100 == 1)) {
	    System.out.print("  n2="+n2+" n3="+n3+"       filePos "+filePos );
	    System.out.println(" getRecsize() "+ _system.getRecsize()+ " getPixelSize() "+_system.getPixelSize() );
	} ***/
	// System.out.print(" NBB="+_system.getNBB()+" _line_prefix_bytes=" +_line_prefix_bytes);
	// System.out.println("   filePos: "+filePos);
	return filePos;
    }


/***********************************************************************
 * Returns a deep copy of the <code>VicarLabel</code> object for this file.
 * This routine should <em>not</em> be used to retrieve the system label
 * bean; use <code>getSystemLabel()</code> instead.
 * <p>
 * Note that requesting the label via this routine will cause the EOL labels
 * to be read if needed.  On a sequential-only stream, this could get you
 * into trouble and thus this should be done only after the image data has
 * been read.  If random access is possible but not easy, this can be done
 * before reading the data but you could take a significant performance hit.
 * If it is easy, then this can be called any time.
 * <p>
 * @see #getSystemLabel()
 * @throws IOException if an EOL read is required, and fails.  Will not occur
 * for random-easy streams.
 */
 
 
    public synchronized VicarLabel getVicarLabel() throws IOException
    {
        /*** we must implement this method to satisfy the VicarInput interface
	// The second condition is redundant, but just in case...
	if (!_label.isReadComplete() && _system.getEOL() != 0) {
	    seekToLocation(_lblsize_front + _image_size_bytes);
	    // _lblsize_eol = _label.readLabelChunk((InputStream) _input_stream);
	    _lblsize_eol = _label.readLabelChunk((Object) _input_stream);

	    // We do not seek back because of sequential or random-hard files.
	    // The next file access will go wherever it needs to; let's
	    // minimize work here.
	}
	_label.setReadComplete(true);

	return (VicarLabel)_label.clone();
	********************/
	    if (_embeddedVicarLabel != null) {
	        return (VicarLabel)_embeddedVicarLabel.clone();
	    }
	    else {
	        return null;
	    }
    }

/***********************************************************************
 * Indicates whether or not the <code>PDSLabel</code> has been completely
 * read.  This can be used with sequential or random-hard streams to determine
 * whether or not <code>getVicarLabel()</code> will do bad things.  The label
 * will always be completely read for random-easy streams, or for any stream
 * if there are no EOL labels.
 * @see #getVicarLabel()
 */
    public synchronized boolean isLabelComplete()
    {
	// return _label.isReadComplete();
	if (_PDS_document != null)
	    return true;
	else return false;
    }

    /**
     * get_File_Area_Observational_type
     * @return
     * This is the pds: type of the data stored in this file
     * Some variant of Array_ is an image
     * Some variant of Table_ is a table
     */
    public String get_File_Area_Observational_type() {
    	return _File_Area_Observational_type;
    }
    
    /**
     * isTable
     * @return
     * This is the pds: type of the data stored in this file
     * Some variant of Array_ is an image
     * Some variant of Table_ is a table
     */
    public boolean isTable() {
    	return _File_Area_Observational_type.contains("Table");
    	
    }
    
    /**
     * isImage
     * @return
     * This is the pds: type of the data stored in this file
     * Some variant of Array_ is an image
     * Some variant of Table_ is a table
     */
    public boolean isImage() {
    	return _File_Area_Observational_type.contains("Array");
    	
    }


    public boolean getFlip_image_horizontal() {
    	return _flip_image_horizontal;
    }
    
    public boolean getFlip_image_vertical() {
    	return _flip_image_vertical;
    }
////////////////////////////////////////////////////////////////////////

}

