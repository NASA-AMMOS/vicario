#!/usr/bin/env python

"""
A command-line utility for manipulating XML files, specifically designed for
swapping elements between two XML documents, even when they involve complex
PDS4 namespaces.

This script provides three primary modes of operation:
1.  **Replace Mode:** Replaces a specified XML element in a target file with an
    element from a source file. This is useful for correcting or updating
    sections of an XML label file.
2.  **List Mode:** Inspects an XML file and prints a list of all unique structural
    XPath expressions for its elements, helping users discover the correct XPath.
3.  **Show Mode:** Inspects an XML file and displays the content of the element(s)
    matching a given XPath.

The script is built using the `lxml` library, which handles namespaces better than
the built-in library.

Usage Examples:
-----------------
1. Replace an element using the same XPath for both source and target:
   python swap_xml.py target.xml "//pds:File_Area_Observational" source.xml output.xml

2. Replace an element using different XPaths for source and target:
   python swap_xml.py target.xml "//pds:Target_Element" source.xml output.xml "//pds:Source_Element"

3. List all unique structural XPaths in a file:
   python swap_xml.py file_to_inspect.xml --list-xpaths

4. Show the content of an element at a specific XPath:
   python swap_xml.py file_to_inspect.xml "//pds:Display_Settings" --show-xpath

5. Run a command with verbose debug output:
   python swap_xml.py [args...] --debug
"""

import argparse
import copy
import logging
import os
import re
import sys

from lxml import etree as ET

class LogConfig:
    """Handles the configuration of the script's logger."""

    @classmethod
    def init(cls, debug=False):
        """
        Configures the root logger for the script.

        Args:
            debug (bool): If True, sets the logging level to DEBUG for verbose
                          output. Defaults to INFO.
        """
        log_level = logging.DEBUG if debug else logging.INFO
        logging.basicConfig(
            level=log_level,
            format='%(message)s'
        )
        logging.debug("Debug logging enabled.")


class XmlIo:
    """Handles file read and write operations for XML files using lxml."""

    @classmethod
    def read(cls, xml_path):
        """
        Parses an XML file from the given path.

        Args:
            xml_path (str): The full path to the XML file.

        Returns:
            lxml.etree._ElementTree: The parsed XML tree object, or None if
                                     parsing fails.
        """
        if not xml_path:
            logging.error("File path cannot be empty.")
            return None
        
        xml_tree = None
        try:
            # Use a parser that removes insignificant whitespace for a cleaner tree
            parser = ET.XMLParser(remove_blank_text=True)
            xml_tree = ET.parse(xml_path, parser)
        except FileNotFoundError:
            logging.error(f"The file '{xml_path}' was not found.")
        except ET.XMLSyntaxError as pe:
            logging.error("Error parsing XML file. Please check "
                          f"if it's well-formed. Details: {pe}")
        except Exception as ex:
            logging.error(f"An unexpected error occurred: {ex}", 
                          exc_info=True)
        return xml_tree

    @classmethod
    def write(cls, xml_tree, output_path):
        """
        Writes the XML tree to a file.

        Args:
            xml_tree (lxml.etree._ElementTree): The XML tree to write.
            output_path (str): The path to the output file.

        Returns:
            bool: True if the write was successful, False otherwise.
        """
        success = False
        try:
            xml_tree.write(
                output_path,
                encoding='utf-8',
                xml_declaration=True,
                pretty_print=True
            )
            success = True
        except (IOError, PermissionError) as err:
            logging.error(f"Error writing to file '{output_path}': {err}")
        return success


class XmlHelper:
    """Provides helper methods for XML operations, like listing XPaths."""

    @classmethod
    def show_element_for_xpath(cls, xml_path, xpath):
        """
        Parses an XML file and displays the content for a given XPath.

        Args:
            xml_path (str): The path to the XML file to inspect.
            xpath (str): The XPath expression for the element to show.
        """
        logging.info(f"Showing element(s) for XPath '{xpath}' in: {xml_path}")
        xml_tree = XmlIo.read(xml_path)
        if not xml_tree:
            return  # Error already logged by XmlIo.read

        root = xml_tree.getroot()
        ns_map = root.nsmap.copy()
        if None in ns_map:
            del ns_map[None]
        
        try:
            matches = root.xpath(xpath, namespaces=ns_map)
            if not matches:
                logging.warning(f"No elements found matching XPath: {xpath}")
                return

            logging.info(f"Found {len(matches)} matching element(s):")
            for i, element in enumerate(matches, 1):
                # Use tostring to pretty-print the element subtree
                xml_string = ET.tostring(element, pretty_print=True, encoding='unicode')
                print(f"--- Match {i} ---\n{xml_string}")

        except ET.XPathError as xpe:
            logging.error(f"Invalid XPath expression. Details: {xpe}")


    @classmethod
    def list_element_xpaths(cls, xml_path):
        """
        Parses an XML file and prints a unique XPath for every element.
        """
        logging.info(f"Listing all element XPaths for: {xml_path}")
        xpaths = cls.get_simple_xpaths(xml_path)
        for xp in xpaths:
            # Use print here for cleaner output, as info adds "INFO:root:"
            print(xp)


    @classmethod
    def get_simple_xpaths(cls, xml_path):
        """
        Returns a sorted list of unique simple XPath expressions in the XML file.
        Elements in the default namespace will not use a prefix.
        """
        # Use the consistent reader to respect parser settings
        tree = XmlIo.read(xml_path)
        if not tree:
            return [] # Return empty list if parsing failed
        
        root = tree.getroot()

        # Build URI to prefix map, handling default namespace
        uri_to_prefix = {}
        for prefix, uri in root.nsmap.items():
            if prefix is None:
                uri_to_prefix[uri] = None  # No prefix for default
            else:
                uri_to_prefix[uri] = prefix

        paths = set()

        def recurse(node, path):
            tag = node.tag
            if isinstance(tag, str) and tag.startswith('{'):
                uri, local = tag[1:].split('}', 1)
                prefix = uri_to_prefix.get(uri)
                if prefix is None and uri in uri_to_prefix:
                    tag_name = local  # default namespace: no prefix
                elif prefix:
                    tag_name = f"{prefix}:{local}"
                else:
                    tag_name = local # Fallback for no known prefix
            else:
                tag_name = tag  # not in a namespace

            current_path = f"{path}/{tag_name}"
            paths.add(current_path)

            for child in node:
                # Ensure we don't process comments or processing instructions
                if isinstance(child.tag, str):
                    recurse(child, current_path)

        recurse(root, '')
        return sorted(paths)


class XmlSwapper:
    """Contains the core logic for swapping XML elements between documents."""
        
    @classmethod
    def swap_element(cls, target_tree, target_xpath, source_tree, source_xpath=None):
        """
        Replaces an XML element in a target file with an element from a source file.

        Args:
            target_tree (lxml.etree._ElementTree): The parsed target XML document.
            target_xpath (str): The XPath expression to find the element
                                  to replace in the target document.
            source_tree (lxml.etree._ElementTree): The parsed source XML document.
            source_xpath (str, optional): The XPath expression to find the element to copy
                                          from the source document. If None, `target_xpath` is used.
        """
        if not target_xpath or not target_xpath.strip():
            logging.error("Target XPath cannot be empty.")
            return False

        # If no source path is specified, use the target path for both.
        xpath_for_source = source_xpath if source_xpath else target_xpath

        try:
            source_root = source_tree.getroot()
            target_root = target_tree.getroot()

            # Combine namespaces from both documents to handle all prefixes.
            ns_map = source_root.nsmap.copy()
            ns_map.update(target_root.nsmap)
            if None in ns_map:
                del ns_map[None]
            
            logging.debug(f"Using combined namespace map for XPath: {ns_map}")

            source_matches = source_root.xpath(xpath_for_source, namespaces=ns_map)
            if len(source_matches) == 0:
                logging.error(f"XPath: No matching element for '{xpath_for_source}' in source file")
                return False
            elif len(source_matches) > 1:
                logging.error(f"Ambiguous XPath: Found {len(source_matches)} matching elements for '{xpath_for_source}' in source file")
                return False

            target_matches = target_root.xpath(target_xpath, namespaces=ns_map)
            if len(target_matches) == 0:
                logging.error(f"XPath: No matching element for '{target_xpath}' in target file")
                return False
            elif len(target_matches) > 1:
                logging.error(f"Ambiguous XPath: Found {len(target_matches)} matching elements for '{target_xpath}' in target file")
                return False

            element_to_copy = source_matches[0]
            element_to_replace = target_matches[0]
            
            parent_element = element_to_replace.getparent()
            if parent_element is None:
                logging.error("Cannot replace the root element of the document.")
                return False
            
            element_to_copy_imported = copy.deepcopy(element_to_copy)

            # For debug...
            src_xml_string = ET.tostring(element_to_copy_imported, pretty_print=True, encoding='unicode')
            tgt_xml_string = ET.tostring(element_to_replace, pretty_print=True, encoding='unicode')
            logging.debug(f"-- Replacing :\n{tgt_xml_string}\n-- with :\n{src_xml_string}")
            
            parent_element.replace(element_to_replace, element_to_copy_imported)

            return True

        except ET.XPathError as xpe:
            logging.error(f"Invalid XPath expression. Details: {xpe}")
            return False
        except Exception as ex:
            logging.error("An unexpected error occurred during swap: "
                          f"{ex}", exc_info=True)
            return False


class MainArgs:
    """Handles parsing and validation of command-line arguments."""

    @classmethod
    def create_parser(cls):
        """Creates and configures the argparse.ArgumentParser instance."""
        parser = argparse.ArgumentParser(
            description="Replaces an XML element in a target file or lists available XPaths in a file.",
            formatter_class=argparse.RawTextHelpFormatter,
            epilog="""Examples:
  To replace an element:
    python %(prog)s target.xml "//pds:File_Area_Observational" source.xml output.xml

  To replace an element using a different source XPath:
    python %(prog)s target.xml "//pds:Target_Element" source.xml output.xml "//pds:Source_Element"
  
  To list all structural XPaths in a file:
    python %(prog)s file_to_inspect.xml --list-xpaths

  To show the content of a specific element:
    python %(prog)s file_to_inspect.xml "//pds:File_Area_Observational" --show-xpath

  To enable debug logging:
    python %(prog)s [args...] --debug"""
        )
        
        # --- Positional Arguments ---
        parser.add_argument("target_path", help="The file path for the target XML to be modified (or the file to inspect).")
        parser.add_argument("target_xpath", nargs='?', help="The XPath string to locate the element to replace in the target file.")
        parser.add_argument("source_path", nargs='?', help="The file path for the source XML providing the new element.")
        parser.add_argument("output_path", nargs='?', help="The file path to save the modified XML.")
        parser.add_argument("source_xpath", nargs='?', default=None, help="Optional XPath for the source file. If not provided, target_xpath is used.")
        
        # --- Inspection Flags ---
        parser.add_argument("--list-xpaths", action="store_true", help="List all available element XPaths from the target_path file and exit.")
        parser.add_argument("--show-xpath", action="store_true", help="Show the XML content for the specified XPath in the target_path file and exit.")
        
        # --- Flag Modifiers ---
        parser.add_argument("--debug", action="store_true", help="Enable debug level logging for verbose output.")
        return parser

    @classmethod
    def enforce_args_for_replace(cls, args, parser):
        """Validates that all required arguments for the replace operation are present."""
        required_args = [args.target_path, args.target_xpath, args.source_path, args.output_path]
        if not all(required_args):
            parser.error("For replacement, target_path, target_xpath, source_path, and output_path are required.")

        if not os.path.isfile(args.target_path):
            parser.error(f"The target file was not found at: {args.target_path}")

        if not os.path.isfile(args.source_path):
            parser.error(f"The source file was not found at: {args.source_path}")
        
        output_dir = os.path.dirname(args.output_path) or '.'
        if not os.path.isdir(output_dir):
            parser.error(f"The output directory does not exist: {output_dir}")
        if not os.access(output_dir, os.W_OK):
            parser.error(f"The output directory is not writable: {output_dir}")


class MainApp:
    """Main application class to orchestrate the script's workflow."""

    def __init__(self, parser, args):
        """
        Initializes the application.

        Args:
            parser (argparse.ArgumentParser): The configured argument parser.
            args (argparse.Namespace): The parsed command-line arguments.
        """
        self.parser = parser
        self.args = args
        LogConfig.init(debug=args.debug)

    def abort(self):
        """Logs an abort message and exits the script with an error code."""
        logging.error("Aborting")
        sys.exit(1)

    def run(self):
        """
        Determines which mode to run based on the command-line arguments.
        """
        if self.args.show_xpath:
            self.run_show_xpath()
        elif self.args.list_xpaths:
            self.run_list_paths()
        else:
            self.run_replace()

    def run_show_xpath(self):
        """Executes the workflow for showing an element by XPath."""
        if not self.args.target_path or not self.args.target_xpath:
            self.parser.error("target_path and target_xpath are required when using --show-xpath.")

        if not os.path.isfile(self.args.target_path):
             self.parser.error(f"The file to inspect was not found at: {self.args.target_path}")
        
        XmlHelper.show_element_for_xpath(self.args.target_path, self.args.target_xpath)
        sys.exit(0)

    def run_list_paths(self):
        """Executes the workflow for listing XPaths."""
        if not self.args.target_path:
            self.parser.error("target_path is required when using --list-xpaths.")
        if not os.path.isfile(self.args.target_path):
            self.parser.error(f"The file to inspect was not found at: {self.args.target_path}")
        XmlHelper.list_element_xpaths(self.args.target_path)
        sys.exit(0)

    def run_replace(self):
        """Executes the workflow for replacing an XML element."""
        MainArgs.enforce_args_for_replace(self.args, self.parser)

        logging.debug(f"Target: {self.args.target_path}")
        logging.debug(f"Source: {self.args.source_path}")
        logging.debug(f"Output: {self.args.output_path}")
        logging.debug(f"Target XPath: {self.args.target_xpath}")
        if self.args.source_xpath:
            logging.debug(f"Source XPath: '{self.args.source_xpath}'")

        target_tree = XmlIo.read(self.args.target_path)
        source_tree = XmlIo.read(self.args.source_path)

        if source_tree is None or target_tree is None:
            self.abort()

        success_flag = XmlSwapper.swap_element(
            target_tree,
            self.args.target_xpath,
            source_tree, 
            source_xpath=self.args.source_xpath
        )
        if not success_flag:
            self.abort()

        success_flag = XmlIo.write(target_tree, self.args.output_path)
        if not success_flag:
            self.abort()

        logging.info(f"Output written to {self.args.output_path}")
        sys.exit(0)


def main():
    """
    Entry point of the script. Parses arguments and runs the main application.
    """
    parser = MainArgs.create_parser()
    args = parser.parse_args()
    main_app = MainApp(parser, args)
    main_app.run()


if __name__ == "__main__":
    main()