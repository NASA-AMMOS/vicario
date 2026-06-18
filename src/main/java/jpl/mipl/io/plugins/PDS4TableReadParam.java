/*
 * * @(#)PDS4TableReadParam.java	1.0 14/12/16
 *
 * Steve Levoe
 * Jet Propulsion Laboratory
 * Multimission Image Processing Laboratory
 * 12-2014
 * 
 * 
 * 
 * Tables are not really handled by ImageIO. This class inherits from ImageReadParam
 * so that it can be used in the same way as any other ImageIO ImageReadParam.
 * This is trying to allow tables to be read in some limited ways
 * as an ImageIO plugin. The Table Read params describe how the table data should be
 * read and what will be returned to the user.
 * The output of the table reader is either text information about the table or 
 * a CSV or fixed length text file.
 * This is part of an ImageIO wrapper for the Ames pds4-tools package.
 */


package jpl.mipl.io.plugins;

import javax.imageio.ImageReadParam;
import java.io.File;



public class PDS4TableReadParam extends ImageReadParam {
	
	boolean listTables = false;
	String fields = ""; // null
	String output_format = FIXED_WIDTH_OPTION;
	int index = 1;
	File outputFile = null;
	String outputFileName = "";
	String quoteCharacter = "\"";
	
	String lineSeparator = PLATFORM_OPTION;
	
	String fieldSeparator = " "; // default is for fixed-width
	String CSV_fieldSeparator = ",";
	String Fixed_Width_fieldSeparator = " ";
	
	String labelFileName = "";
	File labelFile = null;

	public PDS4TableReadParam() {
		// TODO Auto-generated constructor stub
	}

	/**
	 * @param args
	 */
	public static void main(String[] args) {
		// TODO Auto-generated method stub

	}
	
	public void printValues() {
		System.out.println("PDS4TableReadParam.printValues()");
		System.out.println("fields = "+fields);
		System.out.println("index = "+index);
		System.out.println("output_format = "+output_format);
		System.out.println("labelFile = "+labelFile);
		System.out.println("list_tables = "+listTables);
		System.out.println("outputFileName = "+outputFileName);
		System.out.println("fieldSeparator = "+fieldSeparator);
		
		System.out.println("OutputFormat.CSV_OPTION " +OutputFormat.CSV_OPTION+" - "+CSV_OPTION);
		System.out.println("OutputFormat.FIXED_WIDTH "+OutputFormat.FIXED_WIDTH_OPTION+" - "+FIXED_WIDTH_OPTION);
	}
	
	/* setters and getters */
	public void setListTables(boolean f) {
		listTables = f;
	}
	
	public boolean getListTables() {
		return listTables ;
	}
	
	public void setLabelFile(File f) {
		labelFile = f;
	}
	
	public File getLabelFile() {
		return labelFile ;
	}
	
	public void setLabelFileName(String f) {
		labelFileName = f;
	}
	
	public String getLabelFileName() {
		return labelFileName ;
	}
	

	public void setFields(String f) {
		fields = f;
	}
	
	public String getFields() {
		return fields ;
	}
	
	public void setOutput_format(String f) {
		
		if ( f.equals(CSV_OPTION) || f.equals(FIXED_WIDTH_OPTION)) {
			output_format = f;
		} // else set to default??
	}
	
	public String getOutput_format() {
		return output_format ;
	}
	
	public void setOutputFileName(String f) {
		outputFileName = f;
		// create a File from the outputFileName ??
	}
	
	public String getOutputFileName() {
		return outputFileName ;
	}
	
	public void setOutputFile(File f) {
		outputFile = f;
		
	}
	
	public File getOutputFile() {
		return outputFile ;
	}
	
	public void setLineSeparator(String f) {
		if ( f.equals(PLATFORM_OPTION) || f.equals(UNIX_OPTION) || f.equals(WINDOWS_OPTION)) {
			lineSeparator = f;
		} // else set to default??
	}
	
	public String getLineSeparator() {
		return lineSeparator ;
	}
	
	public void setFieldSeparator(String f) {
		fieldSeparator = f;
		
	}
	
	public String getFieldSeparator() {
		return fieldSeparator ;
	}
	
	public void setIndex(int i) {
		index = 1;
		
	}
	
	public int getIndex() {
		return index ;
	}
	
	
	
	private static final String CSV_OPTION = "csv";
	private static final String FIXED_WIDTH_OPTION = "fixed-width";
	private static enum OutputFormat { CSV_OPTION, FIXED_WIDTH_OPTION } ;
	
	private static final String PLATFORM_OPTION = "platform";
	private static final String UNIX_OPTION = "unix";
	private static final String WINDOWS_OPTION = "windows";
	
	
	String WINDOWS_OPTION_lineSeparator = "\r\n";
	String UNIX_OPTION_lineSeparator = "\n";


}
