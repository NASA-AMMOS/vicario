package jpl.mipl.io.plugins;

import java.awt.image.BufferedImage;
import java.awt.image.DataBuffer;
import java.awt.image.RenderedImage;
import java.io.BufferedReader;
import java.io.DataInputStream;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;

import javax.imageio.IIOException;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.ImageTypeSpecifier;
import javax.imageio.metadata.IIOMetadata;
import javax.imageio.spi.ImageReaderSpi;
import javax.imageio.stream.FileImageInputStream;
import javax.imageio.stream.ImageInputStream;

import org.w3c.dom.Document;

import com.sun.media.jai.codec.SeekableStream;

import jpl.mipl.io.streams.DataInputStreamWrapper;
import jpl.mipl.io.util.ExtractTableJPL;
import jpl.mipl.io.vicar.PDS4InputFile;
import jpl.mipl.io.vicar.SystemLabel;

public class PDS4TableReader extends ImageReader {
	
	ImageReadParam param = null;
	PDS4TableReadParam tableReadParam = null;
	
	boolean fakeImageNoRead = true; 
	
	boolean debug = false;
	// boolean debug = true;
	
	private boolean haveReadHeader = false;
    
    boolean gotHeader = false;
	boolean gotMetadata = false;

	private PDS4InputFile pif;
    PDS4Metadata pds4Metadata = new PDS4Metadata();
    
    private PDSImageReadParam pdsImageReadParam;
    // will we need a PDS4ImageReadParam or can we use the existing one??
    private SystemLabel sys; // we need a system label object for all the reader routines
    
    String filename = null; // can used by the native OAL reader code
    
    private SeekableStream seekableStream;
    // vicarIO currently uses SeekableStream
    // may transition to ImageInputStream ?????

    // private FileImageInputStream fileStream; 
    private ImageInputStream stream; 
    private DataInputStreamWrapper inputStreamWrapper;
    DataInputStream pixelStream = null;
    BufferedReader bufferedReader = null;
    
    FileImageInputStream fileStream = null;

    BufferedImage theImage = null;
    Document document;
    
   

	public PDS4TableReader(ImageReaderSpi originatingProvider) {
		super(originatingProvider);
		// TODO Auto-generated constructor stub
	}

	@Override
	public int getHeight(int imageIndex) throws IOException {
		// TODO Auto-generated method stub
		return 0;
	}

	@Override
	public IIOMetadata getImageMetadata(int imageIndex) throws IOException {
		// This should return the PDS4 label.
		// check what happens in the PDS4ImageReader
		// This would be useful when we are only trying to create a detachedlabel
		
		if (debug) System.out.println("PDSImageReader.getImageMetadata("+imageIndex+")");
        if (imageIndex != 0) {
            throw new IndexOutOfBoundsException("imageIndex != 0!");
        }
        readMetadata(); // make sure vicarMetadata has valid data in it
        return pds4Metadata;
		// return null;
	}
	
	/**
	* Just get the VicarLabel Object from the read. Put the VicarLabel 
	* into the VicarMetadata Object held by "this" (the reader).
	* The metadata trees will be generated when they are requested from the 
	* VicarMetadata class. 
	**/
	private void readMetadata() throws IIOException {
		if (debug) System.out.println("PDS4ImageReader.readMetadata");
		if (gotMetadata) {
			return;
		}
	        
		if (haveReadHeader == false) {
			readHeader();
		}
	}
	
	/**
     * Reads the entire header, storing all header data, including comments,
     * into a list of tokens.  Each comment, to the end of the line where it
     * occurs, is considered a single token.
     */
    private void readHeader() throws IIOException {
        
        this.haveReadHeader = true;

        
        if (debug) {   
            System.out.println("PDS4TableReader.readHeader");  
            System.out.println("this.pdsImageReadParam "+this.pdsImageReadParam);
            System.out.println("input="+input);    
            System.out.println("filename="+filename);
            System.out.println("stream="+stream);
                     
        }
        
        // input=javax.imageio.stream.FileImageInputStream@41f8f72f
        
        if (stream == null && seekableStream == null && 
            inputStreamWrapper == null && filename == null && 
            input == null) {
            throw new IllegalStateException ("Input stream not set");
        }
        
        try
        {
            // for now use seekableStream
            // vif = new VicarInputFile();
            
           if (stream != null) {
                if (debug) {     
                  System.out.println("stream " + stream.getClass().getName()+" *@#$%^&* ");
                }
                // 20110709, xing
                //pif = new PDSInputFile();
                pif = new PDS4InputFile(this.pdsImageReadParam);
                pif.open( stream);
            }
            else if (inputStreamWrapper != null) {
                if (debug)  {                   
                  System.out.println("inputStreamWrapper " + inputStreamWrapper.getClass().getName());
                }
                
                // vif.open(inputStreamWrapper);
                // 20110709, xing
               //pif = new PDSInputFile();
                pif = new PDS4InputFile(this.pdsImageReadParam);
                pif.open(inputStreamWrapper);
                // public void open(InputStream is) throws IOException
                // public synchronized void open(InputStream is, boolean sequential_only) throws IOException
            }
            else if (seekableStream != null) {
                if (debug) { 
                  System.out.println("seekableStream " + seekableStream.getClass().getName());
                }
                // vif.open(seekableStream);
                // 20110709, xing
                //pif = new PDSInputFile();
                pif = new PDS4InputFile(this.pdsImageReadParam);
                pif.open(seekableStream);
            } if (input != null) {
            	
            	String cname = input.getClass().getName();
                if (debug) { 
                    System.out.println("input " + cname);
                  }
                  // vif.open(seekableStream);
                  // 20110709, xing
                  //pif = new PDSInputFile();
                  pif = new PDS4InputFile(this.pdsImageReadParam);
                  pif.open(input);
            }
           
           // is this all I need??
           
            if (debug)     {
                System.out.println( "****************************************");
                System.out.println( "* sys = "+sys);           
                System.out.println( "*  PDS4ImageReader pif.getSystemLabel()");
            }
           // check if sys is null ??     
           sys = pif.getSystemLabel();
           //  String pds4_file_type = pif.findPDS4_file_type();
           String  pds4_file_type = pif.get_File_Area_Observational_type();
            
           if (debug)     {
                System.out.println( "*    pds4_file_type = "+ pds4_file_type);
                System.out.println( "****************************************");
        
                System.out.println("PDS4ImageReader.readHeader() after pif.open() !@#$%^&*()+");
                // System.out.println(pif.getVicarLabel().toString());

                System.out.println("System label:"+sys);
                // System.out.println(sys.toString());
                // readHeader(input);
                System.out.println("--------------- PDSFile opened OK");           
           	}
            // input.close(); // we keep the stream around so we can read in the data
          }
        /**
        catch (IOException ex)
        {
            System.out.println("IOException Error reading header:"+ex.getMessage());
            ex.printStackTrace();
            return;
        } **/
       
        catch (Exception ex)
        {
            System.out.println("Exception PDS4ImageReader. Error reading header:"+ex.getMessage());
            ex.printStackTrace();
            return;
        }
        
        
       document = pif.getPDS4Document(); // should use accessor instead
       if (document != null) {
            if (debug) {
                System.out.println("PDS4ImageReader new PDS4Metadata with document");
                System.out.println("+++++++++++++++++++++++++++++++++++++++++++++++");
            }
            pds4Metadata = new PDS4Metadata(document);
            gotMetadata = true;
            // return ;
       } else {
            if (debug) {
                System.out.println("no document avaiable from pif");
                System.out.println("PDS4ImageReader NO PDS4Metadata ************");
            }
            return;
       }
       
       if (debug)  System.out.println("+++++++++++++++++++++++++++++++++++++++++++++++");
        
        if (debug) System.out.println("*** end of PDS4Reader.ReadHeader *****");
        haveReadHeader = true;
    }

	@Override
	public Iterator<ImageTypeSpecifier> getImageTypes(int imageIndex)
			throws IOException {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public int getNumImages(boolean allowSearch) throws IOException {
		// TODO Auto-generated method stub
		return 0;
	}

	@Override
	public IIOMetadata getStreamMetadata() throws IOException {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public int getWidth(int imageIndex) throws IOException {
		// TODO Auto-generated method stub
		return 0;
	}
	
	// additional overides for ImageReader
	/**
     * getDefaultReadParam()
     */
    public ImageReadParam getDefaultReadParam() {
        if (debug) System.out.println("PDS4TableReader.getDefaultReadParam");
        
        return new PDS4TableReadParam();
    }
    
    public String getFormatName()  throws IIOException {
        if (debug) System.out.println("PDS4TableReader.getFormatName()");
        return "pds4table";
    }	
	// where does getAsRenderedImage() come from ImageReader
	// should have a stub for it too, return a fake RenderedImage??
	// This would be useful when we are only attempting to create a new PDS4 (pds3??) detached label
	// will also need the ImageMatadata 
    @Override
	public boolean canReadRaster() {
		if (debug) {
			System.out.println("PDS4TableReader.canReadRaster()");
		}
		return false;
	}
	
	@Override
	public RenderedImage readAsRenderedImage(int imageIndex, ImageReadParam param) {
		if (debug) {
			System.out.println("PDS4TableReader.readAsRenderedImage()");
		}
		return null;
	}
	
	/**
	 * read
	 * @param inputFilename
	 * @return
	 * @throws IOException
	 * we need the inputFilename. This is a quick and dirty way to do it
	 * What must really happen is the inputFilenbame will be included in the 
	 * PDS4TableReadParam 
	 * public BufferedImage read(int imageIndex, ImageReadParam param)
	 */
	public BufferedImage read(String inputFilename)
			throws IOException {
		

		if (debug) {
			System.out.println("PDS4TableReader.read() inputFilename "+inputFilename);
		}
		// setImageReadParam(param);
		String[] args = {inputFilename};
		File labelFile = null;
		
			// in this case we could let ExtractTable write the file if the
			// output_file
			
			// ExtractTableJ extractTable = new ExtractTableJ();
			ExtractTableJPL extractTable = new ExtractTableJPL();
			
			/**
			 * This is a call to the pds4-tools ExtractTableJPL class
			 * Arguments are passed as though they came from a command line.
			 * This argument list is created from the values set in the PDS4TableReadParam.
			 * For now it will be all defaults
			 * data will be printed on standard out as fixed_width text
			 *****/
			extractTable.run(args);
		
			if (debug) {
				System.out.println("after ExtractTableJPL");	
			}
			if (fakeImageNoRead == true) {
				if (debug) {
					System.out.println("PDS4TableReader.read() fakeImageNoRead == true");
				}
				// create a fake BufferedImage?? see PDSImageReader
				// BufferedImage bi =  createFakeBufferedImage();
				// return bi;
			}
		
		
		return null;
	}
	
	@Override
	public BufferedImage read(int imageIndex)
			throws IOException {
		
		return read(imageIndex, (ImageReadParam) null);
	}

	/**
	 * read
	 * @param int imageIndex
	 * @param ImageReadParam param
	 * @return BufferedImage
	 * Will return a fake BufferedImage as a placeholder to create a
	 * IIOImage which holds the Metadata
	 * Other steps may call readAsString() to get real data
	 */
	@Override
	public BufferedImage read(int imageIndex, ImageReadParam param)
			throws IOException {
		
		BufferedImage bi = null;
		if (debug) {
			System.out.println("PDS4TableReader.read() param "+param+" pif "+pif);
		}
		setImageReadParam(param);
		String[] args = {""};
		File labelFile = null;
		
		boolean isTable = false;
		boolean isImage = false;
		if (pif!= null) {
			isTable = pif.isTable();
			isImage = pif.isImage();
		}
		
		
		if (fakeImageNoRead == true) {
			if (debug) {
				System.out.println("PDS4TableReader.read() fakeImageNoRead == true");
			}
			// create a fake BufferedImage?? see PDSImageReader
			// BufferedImage bi =  createFakeBufferedImage();
			// return bi;
			if (debug)  {
                System.out.println("read calling createFakeBufferedImage(1,1) ; ");
                } 
            // let imageTypeSpecifier create the buffered image for us
            bi = createFakeBufferedImage(1,1) ;
		}
		
		if (param != null && param instanceof PDS4TableReadParam) {
			args =  getReadParamArgs((PDS4TableReadParam) param) ;
			if (debug) {
				System.out.println("args "+args);
				for (int i=0 ; i<args.length ; i++) {
					System.out.println(i+") "+args[i]);		
				}
			}
			labelFile = ((PDS4TableReadParam) param).getLabelFile();
		} else {
			// the param object supplies the File labelFile
			// if it is null return null
			// This reader may be called again with a valid PDS4TableReadParam
			// This fake BufferedImage is a placeholder
			return bi;
		}
			
			// in this case we could let ExtractTable write the file if the
			// output_file
			
			// ExtractTableJ extractTable = new ExtractTableJ();
			ExtractTableJPL extractTable = new ExtractTableJPL();
			if (labelFile != null)	{		
				extractTable.setLabelFile(labelFile);
			}
			if (debug) {
				System.out.println("labelFile "+labelFile);	
			}
			/**
			 * This is a call to the pds4-tools ExtractTableJ class
			 * Arguments are passed as though they came from a command line.
			 * This argument list is created from the values set in the PDS4TableReadParam.
			 * For now it will be all defaults
			 * data will be printed on standard out as fixed_width text
			 *****/
			extractTable.run(args);
		
			if (debug) {
				System.out.println("after ExtractTableJPL");	
			}
			
		
		
		return bi;
	}
	
	
	/**
	 * createFakeBuffereImage
	 * @param width
	 * @param height
	 * @return BufferedImage
	 * 
	 * Width and height must not be 0
	 * This BufferedImage is a PlaceHolder object
	 * IIOImage must have a none null image
	 */
	BufferedImage createFakeBufferedImage(int width, int height) {
	// create a fake BufferedImage?? see PDSImageReader
	// BufferedImage bi =  createFakeBufferedImage();
	// return bi;
	// create an ImageTypeSpecifier
		int dataType = DataBuffer.TYPE_BYTE ;
		int bits = 8;
		boolean unsigned = false;
		ImageTypeSpecifier imageType =  ImageTypeSpecifier.createGrayscale(bits, dataType, unsigned);
		if (debug)  {
			System.out.println("imageType.createBufferedImage ");
			System.out.println("imageType "+imageType);
        } 
		// let imageTypeSpecifier create the buffered image for us
		imageType.createBufferedImage(width, height);
		BufferedImage bi = imageType.createBufferedImage(width, height);
		return bi;
	}
	
	/****************************************************************
	 * *
	 * *	readAsString
	 * *
	 * @param imageIndex
	 * @param param
	 * @return
	 * @throws IOException
	 * based on the param this may write the data to a file
	 */
	public String readAsString(int imageIndex, ImageReadParam param)
			throws IOException {
		
		String outputString = "";
		if (debug) {
			System.out.println("PDS4TableReader.readAsString() param "+param);
		}
		setImageReadParam(param);
		// convert all the values in the param to the ones expected by extractTable
		if (param != null && param instanceof PDS4TableReadParam) {
			String[] args =  getReadParamArgs((PDS4TableReadParam) param) ;
			if (debug) {
				for (int i=0 ; i<args.length ; i++) {
					System.out.println(i+") "+args[i]);		
				}
			}
			
			// ExtractTableJ extractTable = new ExtractTableJ();
			ExtractTableJPL extractTable = new ExtractTableJPL();
			File labelFile = ((PDS4TableReadParam) param).getLabelFile();
			
			extractTable.setLabelFile(labelFile);
			if (debug) {
				System.out.println("labelFile "+labelFile);	
			}
			/**
			 * This is a call to the pds4-tools ExtractTableJ class
			 * Arguments are passed as though they came from a command line.
			 * This argument list is created from the values set in the PDS4TableReadParam.
			 * check the arguments to see if extractTable is writing the output file
			 * or we get the string and write it through a writer
			 *****/
			extractTable.run(args);  
			outputString = extractTable.toString();
			
			// outputString = extractTable.getOutputAsString();
		
			if (debug) {
				System.out.println("after ExtractTableJPL");	
			}
			if (fakeImageNoRead == true) {
				if (debug) {
					System.out.println("PDS4TableReader.read() fakeImageNoRead == true");
				}
				
			}
		}
		
		return outputString;
	}
	

	/**
	 * @param args
	 */
	public static void main(String[] args) {
		// TODO Auto-generated method stub

	}
	
	
	// see PDSImageReader
	// we need to create read() and readAsRenderedImage() which will create the fake image??
	// for now we will call ExtractTableJPL 
	
	
	
	
	/* Table specific methods */
	
	
	/* getters and setters */
	

	
	public void setImageReadParam(ImageReadParam _param) {
		param = _param;
		if (_param instanceof PDS4TableReadParam) {
			tableReadParam = (PDS4TableReadParam ) _param;
		}
	}
	
	public ImageReadParam getImageReadParam() {
		return param ;
	}
		
	public void setPDS4TableReadParam(PDS4TableReadParam _param) {
		param = _param;		
		tableReadParam = _param;
	}
	
	public PDS4TableReadParam getPDS4TableReadParam() {
		
		return tableReadParam ;
	}
	
	/**
	 * setReadParamValues
	 * Set all the values from the PDS4TableReadParam 
	 * @param _param
	 */
	public void setReadParamValues(PDS4TableReadParam _param) {
		
	}
	
	public void setDebug(boolean d) {
		debug = d;
	}
	public boolean setDebug() {
		return debug;
	}
	
	public boolean getFakeImageNoRead() {
        return fakeImageNoRead ;        
    }
	
	public void setFakeImageNoRead(boolean f) {
        fakeImageNoRead = f;        
    }
	
	/**
	 * getReadParamArgs
	 * Get an Args array from all the values from the PDS4TableReadParam 
	 * @param _param
	 */
	public  String[] getReadParamArgs(PDS4TableReadParam _param) {
		// build up an array of strings based on the values in the param
		
		if (debug) {
			System.out.println("XXX getReadParamArgs(param) param "+_param);	
		}
		String[] args = {"help"};
		if (_param == null) {
			if (tableReadParam != null) {
				_param = tableReadParam;
				// this will print the help info from ExtractTableJ
				// return args;
			} else {
				if (debug) {
					System.out.println("getReadParamArgs(param) _param is NOT null.");					
				}
				// this will print the help info from ExtractTableJ
				// return args;
			}
		} else {
			// return args;
		}
		
		if (debug) {
			System.out.println("getReadParamArgs(param) param "+_param);	
			System.out.println("_param.getFields() "+ _param.getFields());
			System.out.println("_param.getLineSeparator() "+ _param.getLineSeparator());
			System.out.println("_param.getOutputFileName() "+ _param.getOutputFileName());
			System.out.println("_param.getLabelFileName() "+  _param.getLabelFileName());
		}
		// Creating an empty array list, fill it from the param object
		ArrayList<String> argsList = new ArrayList<String>();
		String s = "";
		
		// build up each String to add to the argsList
		if (_param.listTables) {
			// This overrides all other arguments, just do this 
			argsList.add("--list-tables");
		} else {
			String fields = _param.getFields();
			if (fields != null && !fields.equals("")) {
				argsList.add("--fields");
				argsList.add(fields);
			}
			String output_format = _param.getOutput_format(); // csv or fixed-width
			argsList.add(String.format("--%s", output_format));
			
			String lineSeparator = _param.getLineSeparator();
			argsList.add(String.format("--%s", lineSeparator)); // unix windows platform
			
			String output_filename = _param.getOutputFileName();
			if (output_filename != null && !output_filename.equals("")) {
				argsList.add("--output-file"); // "-o"
				argsList.add(String.format("%s", output_filename));
			}
			
			String fieldSeparator = _param.getFieldSeparator();
			if (!fieldSeparator.equals(" ") && fieldSeparator.equals(",")) {
				argsList.add("--field-separator"); // "-o"
				argsList.add(String.format("%s", fieldSeparator));
			}
			
			// add the input label filename 
			String labelFileName = _param.getLabelFileName();
			// this is a required argument
			argsList.add(labelFileName);
		}
		
		if (argsList.size() > 0) {
			 args = argsList.toArray(new String[argsList.size()]);			
		}
	return args;
	}

} // end of class PDS4TableReader
