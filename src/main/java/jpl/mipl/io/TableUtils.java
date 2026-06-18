package jpl.mipl.io;

import java.io.File;
import java.io.PrintWriter;
import java.util.regex.Pattern;

import jpl.mipl.io.util.ExtractTableJPL; 

/***
import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.CommandLineParser;
import org.apache.commons.cli.GnuParser;
import org.apache.commons.cli.HelpFormatter;
import org.apache.commons.cli.Option;
import org.apache.commons.cli.Options;
import org.apache.commons.cli.ParseException;
***/


public class TableUtils {
	
	private static final String HELP_OPTION = "help";

	private static final String LIST_TABLES_OPTION = "list-tables";

	private static final String FIELDS_OPTION = "fields";

	private static final String INDEX_OPTION = "index";

	private static final String OUTPUT_FILE_OPTION = "output-file";

	private static final String CSV_OPTION = "csv";

	private static final String FIXED_WIDTH_OPTION = "fixed-width";

	private static final String FIELD_SEPARATOR_OPTION = "field-separator";

	private static final String QUOTE_CHARACTER_OPTION = "quote-character";

	private static final String PLATFORM_OPTION = "platform";

	private static final String UNIX_OPTION = "unix";

	private static final String WINDOWS_OPTION = "windows";

	/** A system property name for setting the program name in the
	 * usage message.
	 */
	// private static final String PROGRAM_NAME = "pds4.tools.progname";
	private static final String PROGRAM_NAME = "jpl.mipl.io.progname";

	// private Options options;

	private boolean listTables;
	private File labelFile;
	private File outputFile;
	private PrintWriter out;
	private OutputFormat format;
	private String fieldSeparator;
	private String lineSeparator;
	private String quoteCharacter;
	private Pattern quoteCharacterPattern;
	private int tableIndex;
	private String[] requestedFields;

	

	public TableUtils() {
		// TODO Auto-generated constructor stub
	}

	/**
	 * @param args
	 */
	public static void main(String[] args) {
		// TODO Auto-generated method stub
		System.out.println("TableUtils.main()");
		
		for (int i=0 ; i<args.length ; i++) {
			System.out.println(i+") "+args[i]);			
		}
				
		ExtractTableJPL extractTable = new ExtractTableJPL()	;
		extractTable.run(args);
		String outString = extractTable.getOutputAsString();
		
		System.out.println("after ExtractTableJPL");	
		System.out.println("outString");	
		System.out.println(outString);	
	}
	
	/**
	 * Defines an enumeration for the different output formats.
	 */
	private static enum OutputFormat {
		CSV, FIXED_WIDTH;
	}


}
