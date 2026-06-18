/*
 * @(#)PDS4ImageReaderSpi.java	1.9 01/16/2014
 *
 
 *
 * Steve Levoe
 * Jet Propulsion Laboratory
 * Multimission Image Processing Laboratory
 * 01-2014 PDS4 support
 * This will read PDS4 labeled files
 *
 */

// this is where all the sun plugins currently live
// com.sun.imageio.plugins
// jpl plugins
package jpl.mipl.io.plugins;

import java.io.IOException;
import java.io.EOFException;
// import java.util.Iterator;
import java.util.Locale;
import javax.imageio.ImageReader;
import javax.imageio.spi.ImageReaderSpi;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.FileImageInputStream;

// where did this come from???
// import org.bouncycastle.util.Strings;

import java.io.File;

/**
 * @version 0.1
 */
public class PDS4ImageReaderSpi extends ImageReaderSpi {

    private boolean debug = false;
    // private boolean debug = true;

    private static final String vendorName = "Jet Propulsion Laboratory/MIPL";

    private static final String version = "1.0";

    private static final String[] names = {"pds4"}; 
    
    private static final String[] suffixes = {"lbl", "LBL"};
    // vicar is also .img  This may be a confict/problem                                      
    // no idea what we should use for mime types
    private static final String[] MIMEtypes = {"image/lbl", "image/x-lbl"};
    
    // String[] imageElements= {"Array_2D","Array_2D_Image","Array_2D_Map","Array_2D_Spectrum",
     //                      	"Array_3D", "Array_3D_Image", "Array_3D_Spectrum"};
    String[] imageElements= {"Array_2D_Image","Array_2D_Map","Array_2D_Spectrum",
          	"Array_3D_Image", "Array_3D_Spectrum"};

    /* these are ones we cannot handle in this reader */
    
    String[] movie = {"Array_3D_Movie"};
                      
    String[] headers = {"Encoded_Header", "Header", "Stream_Text"};
   
    /* There should be another Plugin set
      PDS4TableReader, Then we would also need a PDS4TableWriter (and Spi's)
    */
    String[] tables  = {"Table_Binary","Table_Character","Table_Delimited"};
    
    
    
    // use in the super constructor for nmemonic value                                           
    private static boolean _supportsStandardStreamMetadataFormat    =  false;                                     
	private static boolean _supportsStandardImageMetadataFormat      =  false;   
	// this class should support these, FIX IT !!!!      

    private static final String readerClassName =
        "jpl.mipl.io.plugins.PDS4ImageReader";
        
     // private static String[] extraStreamMetadataFormatNames[] = (String[][]) "";
    //  private static String[] extraStreamMetadataFormatClassNames[] = (String[][]) "";
    // Class names are given as strings to avoid loading classes
    // until they are needed.
    private static final String [] writerSpiNames = {
        "jpl.mipl.io.plugins.PDS4ImageWriterSpi"};
        
    //  private static String[] extraImageMetadataFormatNames[] = (String[][]) "";
     // private static String[] extraImageMetadataFormatClassNames[] = (String[][]) "";

    /**
     * No-argument constructor required by Service.
     */
    public PDS4ImageReaderSpi() {
        super(vendorName,
              version,
              names,
              suffixes,
              MIMEtypes,
              readerClassName,
              STANDARD_INPUT_TYPE,
              writerSpiNames,
              _supportsStandardStreamMetadataFormat, // new in 1.4
              // new add Metadata stuff
              PDSMetadata.nativeStreamMetadataFormatName,
              PDSMetadata.nativeStreamMetadataFormatClassName,
              
             null, //  extraStreamMetadataFormatNames,  // new in 1.4
			 null, // extraStreamMetadataFormatClassNames,  // new in 1.4
              
              _supportsStandardImageMetadataFormat, // new in 1.4
              PDSMetadata.nativeImageMetadataFormatName,
              PDSMetadata.nativeImageMetadataFormatClassName,
              
              null, // extraImageMetadataFormatNames,  // new in 1.4
			  null // extraImageMetadataFormatClassNames  // new in 1.4
              );
              
            if (debug)  System.out.println("PDS4ImageReaderSpi 1.4 constructor");
    }

    public void onRegistration() {
        if (debug) {
            System.out.println("PDS4 reader spi: on registration");
        }
    }

    // No localization
    public String getDescription(Locale locale) {
        return "PDS4 Image Reader";
    }

	public Class[] getInputTypes() {
		// Class[] inputTypes = {String.class, ImageInputStream.class };
		Class[] inputTypes = {String.class, File.class, ImageInputStream.class };
		return inputTypes;
	}
	
	
	/*******************************************
	 * 
	 * canDecodeInput
	 * 
	 * Open the file and look for something we recognize
	 * PDS4 files can be data sets which are NOT images .
	 * Tables and others.
	 * Probably we will need to determine if this is an Image.
	 * Return False for files which are NOT images.
	 * Maybe later this library may be required to handle other image type.
	 * If all we want to do is create a detached label we
	 * might be able to ignore the data file and just create a label.
	 * 
	 * True return: we can read this file
	 * False return: we can not read this file
	 */
    public boolean canDecodeInput(Object input)
        throws IOException {
        if (debug) {
            System.out.println("In PDS4ImageReaderSpi.canDecodeInput "+input);
        }

		ImageInputStream stream = null;
		FileImageInputStream fileStream = null;
        // might this be something else ???
        
        if ((input instanceof ImageInputStream)) {
			stream = (ImageInputStream)input;
        }
        else if((input instanceof File)) {
        	fileStream = new FileImageInputStream((File) input);
        	// do I need to close this stream ???
        	stream = fileStream;
        }
        else if ((input instanceof String)) {
			fileStream = new FileImageInputStream(new File((String)input));
						// do I need to close this stream ???
			stream = fileStream;
		}
        else {
        
            return false;
        }
        // else convert/wrap the stream to something we can use

         

        if (debug) {
            // System.out.println("stream ok");
        }

        /*********************
        * ALL of this will change 
        * maybe create an array of a few possible Strings
        * loop thru them to try and find  match
        * <Product_Observational xmlns="http://pds.nasa.gov/pds4
        * don't know if 500 bytes is always enough to be sure.
        * Later may also look for "Array_2D", or "Array_3D" to make sure this is 
        * an image file we can read. Do a second level read if we first
        * find "Product_Observational"
        * There may be many file types we can't read because they are not images
        * It may be possible to handle a non Image file if all we want to do is 
        * create a detached label. 
        * Check if the label contains ANY of these
        * String[] imageElements= ["Array_2D,"Array_2D_Image","Array_2D_Map","Array_2D_Spectrum",
         	"Array_3D", "Array_3D_Image", "Array_3D_Spectrum"];
        * I have no idea what we would try to do with a movie
      	  String[] movie = [Array_3D_Movie"];
        
          String[] headers = ["Encoded_Header", "Header", "Stream_Text"];
          
          There should be another Plugin set
          PDS4TableReader, Then we would also need a PDS4TableWriter (and Spi's)
          
          String[] tables  = ["Table_Binary","Table_Character","Table_Delimited"];
         * wrap the Ames code (user their jar and just add wrapper classes
         * If a user wants to make a PDS4 file from a spreadsheet (csv etc) use the Ames tools
         * Don't make it a transcoder tool
        ***************************/
        
        
     // headers are now much larger. All the preamble junk is more than 500 characters
        // get the size of the stream
        long streamLength = 0;
        try {
            streamLength = stream.length();
        }	catch (IOException ioe) {
            if (debug) {
            	System.out.println("IOException can't get stream.length() "+ioe );      	
            }
            throw new IOException("EOFException PDS4ImageReaderSpi.canDecodeInput can't get stream length");
    	}
        
        if (debug) {
            System.out.println("streamLength = "+streamLength );      	
            }
        
        if (streamLength <= 0) {
        	
        	if (debug) {
	            System.out.println("streamLength = "+streamLength+"  read 2000 bytes at a time if Product_Observational found. " );      	
	            }
        	
        	
        	int byteCount = 2000;
        	int readCount = 0;
        	// get the first 2000 bytes of the stream into byte array
	        byte[] header = new byte[byteCount]; 
	        int read_return = 0;
	        try {
	        	read_return = stream.read(header, 0, byteCount);
	        } catch (IOException ioe) {
                if (debug) {
                	System.out.println("IOException can't read stream "+ioe );      	
                }
                return false;
            }
	        readCount = read_return;
	        if (debug) {
	            System.out.println("read_return = "+read_return+"  readCount = "+readCount );      	
	            }
	        String header_str = new String(header);
        	// return (s.equals("PDS_VERSION_ID"));
        
            //  <?xml version="1.0" encoding="UTF-8" standalone="no"?>
        	if (header_str.contains("Product_Observational") ) {
        		 if (debug) {
                 	System.out.println("PDS4ImageReaderSpi.canDecodeInput TRUE, found Product_Observational");      	
                 }
        		 // now try to read the entire file and determine if it is an image we can read
        		 // loop thru reads of 2000 bytes until we can't read anymore. Then determine type
        		 while (read_return == 2000) {
        			 read_return = 0;
        			 header = new byte[byteCount]; // new one each time. Otherwise you might get leftover junk from the previous read
    		        try {
    		        	// read_return = stream.read(header, readCount, byteCount);
    		        	if (debug) {
    	                 	System.out.println("stream.getStreamPosition() = "+stream.getStreamPosition());  
    		        	}
    		        	stream.getStreamPosition();
    		        	read_return = stream.read(header, 0, byteCount);
    		        	readCount += read_return;
    		        	header_str += new String(header);
    		        	if (debug) {
    	                 	System.out.println("PDS4ImageReaderSpi.canDecodeInput header_str.length() = "+header_str.length());  
    	                 	System.out.println(" read_return = "+read_return+"  readCount = " +readCount); 
    	                 }
    		        	
    		        } catch (IOException ioe) {
    	                if (debug) {
    	                	System.out.println("IOException can't read stream "+ioe );      	
    	                }
    	                stream.reset();
    	                return false;
    	            }	 
        		 }
        		 stream.reset();
        		 if (debug) {
	                 System.out.println("PDS4ImageReaderSpi.canDecodeInput done reading header_str.length() = "+header_str.length());  
	                 System.out.println(" read_return = "+read_return+"  readCount = " +readCount); 
	                 System.out.println(header_str);
	                 }
        		 // now try to find out what type this is
        		// Now loop thru the possible Elements we can handle
        		 boolean ret = false;
        		 for (int i=0 ; i< imageElements.length ; i++) {
        			 if (debug) {
                      	System.out.println("PDS4ImageReaderSpi.canDecodeInput looking for "+imageElements[i]+"  ");      	
                      }
        			 if (header_str.contains(imageElements[i]) ) {
                		 if (debug) {
                         	System.out.println("PDS4ImageReaderSpi.canDecodeInput TRUE, found "+imageElements[i]+"  ");      	
                         }
                	 ret = true;
        			 }
        		 }
        		 return ret;
        		 
        	} else {
        		 if (debug) {
                  	System.out.println("PDS4ImageReaderSpi.canDecodeInput FALSE. DID NOT found Product_Observational, RETURN");      	
                  }
        		
        	}
        	
            return false;

        } else {
	        int byteCount = 2000;
	        
	        if (debug) {
	            System.out.println("streamLength = "+streamLength );      	
	            }
	        if (streamLength < (long) byteCount) {
	            byteCount = (int) streamLength;
	        }
	        if (debug) {
	            System.out.println("byteCount  = "+byteCount  );      	
	            }
	        // get the first 2000 bytes of the stream into byte array
	        byte[] header = new byte[byteCount]; 
	        
	        
	        boolean ret = false;
	        try {
	        	stream.mark();  // Calling routine does this
	        	stream.readFully(header);
	        	stream.reset();
	        
	        	String s = new String(header);
	        	// return (s.equals("PDS_VERSION_ID"));
	        
	        
	        	if (s.contains("Product_Observational") ) {
	        		 if (debug) {
	                 	System.out.println("PDS4ImageReaderSpi.canDecodeInput TRUE, found Product_Observational, file size = "+stream.length());      	
	                 }
	        		 // get the file size, allocate a buffer and read in the whole label 
	        		
	        		stream.mark();  // Calling routine does this
	        		byte[] header2 = new byte[(int)stream.length()];
	             	stream.readFully(header2, 0, (int)stream.length());
	             	stream.reset();
	             
	             	s = new String(header2);
	        		 // Now loop thru the possible Elements we can handle
	        		 for (int i=0 ; i< imageElements.length ; i++) {
	        			 if (debug) {
	                      	System.out.println("PDS4ImageReaderSpi.canDecodeInput looking for "+imageElements[i]+"  ");      	
	                      }
	        			 if (s.contains(imageElements[i]) ) {
	                		 if (debug) {
	                         	System.out.println("PDS4ImageReaderSpi.canDecodeInput TRUE, found "+imageElements[i]+"  ");      	
	                         }
	                	 ret = true;
	        			 }
	        		 }
	        		
	        	}
	        	// Array_2D Array3D
	        // if (fileStream != null) fileStream.close;
	        }	catch (EOFException eofe) {
	            if (debug) {
	            	System.out.println("EOFException "+eofe );      	
	            }
	            throw new IOException("EOFException PDS4ImageReaderSpi.canDecodeInput");
	             
	    	}	catch (NullPointerException npe) {
	        	if (debug) {
	        		System.out.println("NullPointerException "+npe );      	
	        	}
	        	throw new IOException("NullPointerException PDS4ImageReaderSpi.canDecodeInput");
	    	} 
	        
	        return ret;
        }
        
    }

	public void setDebug(boolean d) {
		debug = d;
	}
	
    public ImageReader createReaderInstance() {
     
        if (debug) System.out.println(" createReaderInstance PDS4ImageReader");
        return new PDS4ImageReader(this);
    }
    
    public ImageReader createReaderInstance(Object extension) {
        // we'll ignore this till we know what it does
        if (debug) System.out.println(" createReaderInstance extension="+extension);
        // throw new IllegalArgumentException ("Vicar does not support extensions");
        // find out what an extention might be
        
        return new PDS4ImageReader(this);
    }
    
    /* unimplemented interfaces ....
    public Class[] getInputTypes() {
        // return an array of all the inputs we can handle
        // should include things we can "wrap" to look correct
        ImageInputStream  // we wrap this to look like SeekableStream
        SeekableStream  
        // if we learn how to use the new ones IIO added list them too
        //
    }
    */
    public boolean isOwnReader(ImageReader reader) {
        if (reader instanceof jpl.mipl.io.plugins.PDS4ImageReader) {
            return true;
        } else {
            return false;
        }
    }
    
}
