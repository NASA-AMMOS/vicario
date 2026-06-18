#!/bin/bash

## This script processes a (image, yaml label) pair
## through a series of processing steps; all of which culmiates
## in a GeoTiff and PDS4 label.
## 
## Processing steps:
## 1. Convert image to TIF and skeleton-PDS4 xml via gdal_translate
## 2. Convert YAML text to ingest-able JSON file (for use as $extra 
##    file for transcoder)
## 3. Run transcoder passing the TIF file and JSON $extra
## 4. Replace the offset section of transcoder PDS4 label with the 
##    correct section from the GDAL PDS4 label
## 
## 
## Usage:  label_image_yaml [options] <image> <yaml_label> <mission>
##
## Options:
##       --debug            Enabled debug log level.
##       --retain-files     Retains temporary files.
##       --skip-precheck    Skip tool and env precheck.
##       --output-dir <dir> Directory to save output files.
##       -h, --help         Display this help message and exit.
##

## ==================================================================
## Script fields/state

## retain temp files after processing?
RETAIN_MODE="false"

## debug messages allowed?
DEBUG_MODE="false"

## perform precheck? or go as far as one can?
PRECHECK_MODE="true"

## Directory for output files
OUTPUT_DIR="." # Default to current directory

## ==================================================================
## Functions

## -----------------------------
## -----------------------------

## Prints the script's usage instructions and exits.
## Arguments:
##   $1: An exit code. If "0", usage is printed to standard output
##       an we exit successfully.
##       Otherwise, it's printed to standard error and exit with error.

usage_and_exit() {
    local exit_code=1
    local output_stream="/dev/stderr"

    if [[ "$1" == "0" ]]; then
        exit_code=0
        output_stream="/dev/stdout"
    fi

    echo "Usage: $0 [options] <image> <yaml_label> <mission>" > "$output_stream"
    echo "" > "$output_stream"
    echo "Options:" > "$output_stream"
    echo "  --debug            Enabled debug log level."  > "$output_stream"
    echo "  --retain-files     Retains temporary files."  > "$output_stream"
    echo "  --skip-precheck    Skip tool and env precheck."  > "$output_stream"
    echo "  --output-dir <dir> Directory to save output files." > "$output_stream"
    echo "  -h, --help         Display this help message and exit." > "$output_stream"
    echo "" > "$output_stream"
    exit "$exit_code"
}


## -----------------------------
## -----------------------------

## Helper function for logging debug messages.
## It only prints output if DEBUG_MODE is "true".
log_debug() {
  if [ "$DEBUG_MODE" = "true" ]; then
    echo "DEBUG: $@"
  fi
}

## -----------------------------
## -----------------------------


## Helper function for deleting a file only if
## not in 'retain' mode
rm_maybe() {
    if [ ! -z "$1" ] &&  [ -f "$1" ] && [ "$RETAIN_MODE" = "false" ]; then
        log_debug "Deleting $1"
        rm -f "$1"
    fi
}

## -----------------------------
## -----------------------------

## Helper function for ensuring needed tools are in place
tool_check() {

    log_debug "Checking for required tools..."

    # Define the list of required tools as an array.
    # 'local -r' makes the variable local to the function and read-only.
    local -r REQUIRED_TOOLS=(
        "jq"
        "yq"
        "python"
        "gdal_translate"
        "java"
    )

    # Iterate over the array to check for each tool.
    for tool in "${REQUIRED_TOOLS[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            echo "Error: Required tool '$tool' is not installed or not in your PATH." >&2
            exit 1
        fi
    done

    log_debug "...all required tools are available."
}

## -----------------------------
## -----------------------------


precheck() {

    ## We will be calling a few things, so check now that they are
    ## all available now...
    tool_check


    ## Check templates
    log_debug "Checking for templates..."
    if [ -z "$TEMPLATE_DIR" ]; then
        echo "Required envvar V2TEMPLATES is not set" >&2
        exit 1
    fi
    if [ ! -f "$TEMPLATE_FILE" ]; then
        echo "Template file   '$TEMPLATE_FILE' was not found" >&2
        exit 1
    fi

    if [ -z "$V2JBIN" ]; then
        echo "Required envvar V2JBIN is not set" >&2
        exit 1
    fi
    if [ ! -d "$V2JBIN" ]; then
        echo "V2JBIN directory '$V2JBIN' was not found" >&2
        exit 1
    fi

    ## Check that python can access lxml
    log_debug "Checking Python environment..."
    PY_XML_LIBRARY_NAME="lxml"
    if ! python -c "import $PY_XML_LIBRARY_NAME" >/dev/null 2>&1; then
        echo "Failure: Python cannot import required '$PY_XML_LIBRARY_NAME' library." >&2
        echo "         Please make sure it is installed in your Python environment." >&2
        exit 1
    fi
}


## -----------------------------
## -----------------------------

## List of temporary files that should be removed
TEMP_FILES=()

## Cleans up the temp files unless retain mode is active
cleanup() {

    if [ "$RETAIN_MODE" = "true" ]; then
        log_debug "Retaining temporary files."
        return
    fi

    if [ ${#TEMP_FILES[@]} -eq 0 ]; then
        log_debug "No temporary files to delete."
        return
    fi

    log_debug "Deleting temp files..."

    ## Iterate over each file or pattern in the list.
    for file_or_pattern in "${TEMP_FILES[@]}"; do
        case "$file_or_pattern" in
          ## contains a wildcard character? (*, ?, or [)
          *[\*\?\[]*)
            log_debug "Deleting files matching expression: '$file_or_pattern'"
            ## unquoted variable for glob expansion
            ## The -f flag hides errs for no match
            rm -f $file_or_pattern
            ;;
          ## otherwise asssume filename
          *)
            if [ -f "$file_or_pattern" ]; then
              log_debug "Deleting '$file_or_pattern'"
              rm -f "$file_or_pattern"
            fi
            ;;
        esac
    done
}

## -----------------------------
## -----------------------------



## A function that takes a command and its arguments, logs the command
## debug, executes it, and returns the command's exit code.
## Can optionally redirect stdout to a file or stream.
##
## Usage: log_and_execute_cmd [--out <file|stream>] "${COMMAND_ARRAY[@]}"

log_and_execute_cmd() {

    local lcl_output_target="/dev/stdout"
    local lcl_error_target="/dev/null"

    local lcl_exit_code=0

    # Check for an optional outfile file argument.
    if [[ "$1" == "--out" ]]; then
        lcl_output_target="$2"
        shift 2 # Consume the --outfile flag and the filename
    fi

    ## Hack for allowing stderr with debug enabled, drat
    if [[ $DEBUG_MODE == "true" ]]; then
        lcl_error_target="/dev/stderr"
    fi


    ## Check if any command arguments were passed.
    if [ "$#" -eq 0 ]; then
        echo "Error: log_and_execute_cmd was called with no command." >&2
        return 1
    fi

    ## Log the command being executed, including redirection if applicable.
    if [ -n "$lcl_output_target" ]; then
        log_debug "Executing: $@ > $lcl_output_target"
    else
        log_debug "Executing: $@"
    fi

    ## Execute the command, capturing its exit code.
    ## The '|| exit_code=$?' part ensures that if the command fails,
    ## its non-zero exit code is captured instead of triggering
    ## 'set -o errexit' immediately.
    if [ -n "$lcl_output_target" ]; then
        # Redirect stdout to the specified file.
        "$@" > "$lcl_output_target" 2> ${lcl_error_target} || lcl_exit_code=$?
    else
        # Execute without redirection.
        "$@" 2> ${lcl_error_target} || lcl_exit_code=$?
    fi

    return $lcl_exit_code
}

## -----------------------------
## -----------------------------

## Useful bash configuration (sorry, CSH...)

configure_env() {

    ## Exit immediately if a command exits with a non-zero status
    set -o errexit
    
    ## Exit immediately if a command in a pipeline fails
    set -o pipefail
    ## Treat unset variables as an error
    set -o nounset

    ## 'trap' command registers the 'cleanup' function to be called
    ## on the EXIT signal, either from 'exit' or due to an error.
    trap cleanup EXIT
}

## -----------------------------
## -----------------------------

parse_arguments() {

    ## holds positional args, global var
    POSITIONAL_ARGS=()

    ## Loop through arguments to parse flags.
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --retain-files)
          RETAIN_MODE="true"
          shift
          ;;
        --debug)
          DEBUG_MODE="true"
          shift
          ;;
        --skip-precheck)
          PRECHECK_MODE="false"
          shift
          ;;
        --output-dir)
          if [[ -z "$2" || "$2" == --* ]]; then
              echo "Error: --output-dir flag requires a value." >&2
              usage_and_exit 1
          fi
          OUTPUT_DIR="$2"
          shift 2
          ;;
        -h|--help)
          usage_and_exit 0
          ;;
        *)
          ## Check if the argument looks like a flag, but unknown one
          if [[ "$1" == --* ]]; then
            echo "Error: Unrecognized option '$1'" >&2
            usage_and_exit 1
          fi

          ## Not a flag, so save it as a positional argument.
          POSITIONAL_ARGS+=("$1")
          shift
          ;;
      esac
    done

}

## ==================================================================

## Run the config function

configure_env

## ==================================================================

## Arguments parsing and processing...
parse_arguments "$@"

## Restore the positional arguments.
## The shell's main argument list ($1, $2, etc.) is now reset to only the positional args.
set -- "${POSITIONAL_ARGS[@]}"

## Positional argument Validation
if [ "$#" -ne 3 ]; then
    echo "Error: Invalid number of arguments." >&2
    usage_and_exit 1
fi

INPUT_IMAGE="$1"
INPUT_TXT="$2"
MISSION_STR="$3"

if [ ! -f "$INPUT_IMAGE" ]; then
    echo "Error: Input image '$INPUT_IMAGE' was not found." >&2
    exit 1
fi

if [ ! -f "$INPUT_TXT" ]; then
    echo "Error: Input text label '$INPUT_TXT' was not found." >&2
    exit 1
fi

## Resolve the output directory to an absolute path
OUTPUT_DIR=$(realpath "$OUTPUT_DIR")
if [[ ! -d "$OUTPUT_DIR" ]]; then
    log_debug "Creating output directory: $OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR"
fi


## We dont care about stdout from called proceses, unless
## debug is enabled.  This will be passed to
## log_and_execute_cmd() unless an output file is desired
logexec_output_stream="/dev/null"
## ...but if debug, then pipe to stdout
if [[ $DEBUG_MODE == "true" ]]; then
    logexec_output_stream="/dev/stdout"
fi


## ==================================================================
## Common variables used throughout


BASENAME_IMG=$(basename -- "$INPUT_IMAGE")
FILENAME_IMG="${BASENAME_IMG%.*}"

BASENAME_TXT=$(basename -- "$INPUT_TXT")
FILENAME_TXT="${BASENAME_TXT%.*}"

## All output files will be placed in the output directory
MAIN_OUTPUT_TIF="${OUTPUT_DIR}/${FILENAME_IMG}.tif"
MAIN_OUTPUT_XML="${OUTPUT_DIR}/${FILENAME_IMG}.tif.xml"

TEMPLATE_DIR="$V2TEMPLATES"
TEMPLATE_FILE="$V2TEMPLATES/json_cameras.vm"

VICAR_BIN_DIR="$V2JBIN"

## ==================================================================

## There's a lot of things that may be missing, so perform a pre-check
## now before we start processing?  Otherwise, go as far as ya can
## until a failure is hit (can be useful...?)

if [ "$PRECHECK_MODE" = "true" ]; then

    precheck

fi

## ==================================================================
## ==================================================================
## Step 1: Use GDAL for IMAGE -> IMG.TIF and associated PDS4 XML file


## Creates a new GeoTIFF file and PDS4 label from the input image using gdal_translate.
GDAL_OUT_TIF="${OUTPUT_DIR}/${FILENAME_IMG}.tif"
GDAL_OUT_XML="${OUTPUT_DIR}/${FILENAME_IMG}.xml"
GDAL_RENAMED_XML="${OUTPUT_DIR}/${FILENAME_IMG}.gdal.xml"

## Sigh - so we need to use the non 'gdal' names, but then
## if there's a failure, we need cleanup files ourselves...
## register our temp files for removal
# TEMP_FILES+=("$GDAL_OUT_TIF")
# TEMP_FILES+=("$GDAL_OUT_XML")
TEMP_FILES+=("$GDAL_RENAMED_XML")

log_debug "Calling gdal_translate..."

## Some confusion if last arg should be the TIF of the XML.
## On mipl, when using XML, things seem to work, so...
GDAL_CMD=(
  "gdal_translate"
  "-of" "PDS4"
  "-co" "IMAGE_FORMAT=GEOTIFF"
  "-co" "COMPRESS=NONE"
  "$INPUT_IMAGE"
  "$GDAL_OUT_XML" # GDAL creates the TIF based on this name
)
log_and_execute_cmd --out "$logexec_output_stream" "${GDAL_CMD[@]}"

if [ $? -ne 0 ]; then
    echo "Error: gdal_translate failed to convert '$INPUT_IMAGE'." >&2
    rm_maybe "${GDAL_OUT_TIF}"
    rm_maybe "${GDAL_OUT_XML}"
    exit 1
fi

if [ ! -f "$GDAL_OUT_TIF" ]; then
    echo "Error: Output image '$GDAL_OUT_TIF' was not found after gdal_translate." >&2
    rm_maybe "${GDAL_OUT_XML}"
    exit 1
fi

if [ ! -f "$GDAL_OUT_XML" ]; then
    echo "Error: Output label '$GDAL_OUT_XML' was not found after gdal_translate." >&2
    rm_maybe "${GDAL_OUT_TIF}"
    exit 1
fi

log_debug "...gdal created TIF and PDS4 XML label."

## Rename XML to gdal version for use later
mv "$GDAL_OUT_XML"  "$GDAL_RENAMED_XML"


## ==================================================================
## ==================================================================
## Step 2: Yaml TXT->JSON Label, with cleanup and updates

## Converts the input text file (assumed to be YAML) into a JSON
## document using yq.

YQ_OUTPUT_JSON="${OUTPUT_DIR}/${FILENAME_TXT}.yq.json"
JQ_WS_OUTPUT_JSON="${OUTPUT_DIR}/${FILENAME_TXT}.jq_ws.json"
JQ_MSN_OUTPUT_JSON="${OUTPUT_DIR}/${FILENAME_TXT}.jq_msn.json"

## register our temp files for removal
TEMP_FILES+=("$YQ_OUTPUT_JSON")
TEMP_FILES+=("$JQ_WS_OUTPUT_JSON")
TEMP_FILES+=("$JQ_MSN_OUTPUT_JSON")

## yq to convert txt to JSON
log_debug "Converting text file to JSON format..."

## Store the command and all its arguments in an array
YQ_CMD=(
  "yq"
  "-o" "json"
  "$INPUT_TXT"
)
log_and_execute_cmd --out "$YQ_OUTPUT_JSON" "${YQ_CMD[@]}"
if [ $? -ne 0 ]; then
    echo "Error: yq failed to convert '$INPUT_TXT'." >&2
    exit 1
fi
if [ ! -f "$YQ_OUTPUT_JSON" ]; then
    echo "Error: Output JSON '$YQ_OUTPUT_JSON' was not found after running yq." >&2
    exit 1
fi


log_debug "Cleaning/updating JSON file..."

## Replace whitespace with underscore for JSON keys
JQ_WS_CMD=(
  "jq"
  'walk(if type == "object" then with_entries(.key |= gsub(" "; "_")) else . end)'
  "$YQ_OUTPUT_JSON"
)
log_and_execute_cmd --out "$JQ_WS_OUTPUT_JSON" "${JQ_WS_CMD[@]}"

if [ $? -ne 0 ]; then
    echo "Error: jq failed to convert '$INPUT_TXT'." >&2
    exit 1
fi
if [ ! -f "$JQ_WS_OUTPUT_JSON" ]; then
    echo "Error: Output JSON '$JQ_WS_OUTPUT_JSON' was not found after running jq." >&2
    exit 1
fi

## Insert top-level PDS_SUPPLEMENTAL dict with MISSION_NAME
JQ_MSN_CMD=(
  "jq"
  ". + { \"PDS_SUPPLEMENTAL\": { \"MISSION_NAME\": \"$MISSION_STR\" } }"
  "$JQ_WS_OUTPUT_JSON"
)
log_and_execute_cmd --out "$JQ_MSN_OUTPUT_JSON" "${JQ_MSN_CMD[@]}"

if [ $? -ne 0 ]; then
    echo "Error: jq failed to convert '$INPUT_TXT'." >&2
    exit 1
fi
if [ ! -f "$JQ_MSN_OUTPUT_JSON" ]; then
    echo "Error: Output JSON '$JQ_MSN_OUTPUT_JSON' was not found after running jq." >&2
    exit 1
fi

log_debug "...created JSON input label for transcoder."

## ==================================================================
## ==================================================================
## Step 3: Transcode using TIF and $JQ_MSN_OUTPUT_JSON

## Move to the output dir so that xcoder puts temp files there


XCODER_IN_IMG="$MAIN_OUTPUT_TIF"
XCODER_IN_JSON="$JQ_MSN_OUTPUT_JSON"
XCODER_IN_TEMPLATE="$TEMPLATE_FILE"
XCODER_OUT_XML="${OUTPUT_DIR}/${FILENAME_IMG}.xcode.xml"

## register our temp files for removal
TEMP_FILES+=("$XCODER_OUT_XML")

## other files output by transcoder
TEMP_FILES+=("${OUTPUT_DIR}/velocity.log*") ##uses wildcard
TEMP_FILES+=("${OUTPUT_DIR}/output.xml")

log_debug "Running transcoder..."

pushd "$OUTPUT_DIR" > /dev/null

## In case we need more memory or other stuff...
#XCODER_JAVA_PROPS=""

## Store the command and all its arguments in an array
XCODE_JAVA_CMD=(
  "java"
  #"$XCODER_JAVA_PROPS"
  "jpl.mipl.io.jConvertIIO"
  "inp=$XCODER_IN_IMG"
  "out=$XCODER_OUT_XML"
  "ri=true"
  "pds_label_type=PDS4"
  "format=pds4"
  "pds_detached_only=true"
  "velo_template=$XCODER_IN_TEMPLATE"
  "extra_file_name=$XCODER_IN_JSON"
  "extra_file_type=json"
)

log_and_execute_cmd --out "$logexec_output_stream" "${XCODE_JAVA_CMD[@]}"

if [ $? -ne 0 ]; then
    echo "Transcoder failed." >&2
    exit 1
fi
if [ ! -f "$XCODER_OUT_XML" ]; then
    echo "Error: '$XCODER_OUT_XML' was not found after running transcoder." >&2
    exit 1
fi

popd > /dev/null

log_debug "...transcoder produced its version of PDS4 label."

## ==================================================================
## ==================================================================
## Step 4: Run Python Script to swap xml section

## Annoyance...gdal outputs Array_3D even if product is 2D.
## So we can at least presume it's Xpath is the same (even if wrong)...
## However, we need to check with Xcoder's label to see what IT uses for the XPath (2D vs 3D)
XPATH_PO_FAOS_ARRAY_2D_OFFSET="/pds:Product_Observational/pds:File_Area_Observational/pds:Array_2D_Image/pds:offset"
XPATH_PO_FAOS_ARRAY_3D_OFFSET="/pds:Product_Observational/pds:File_Area_Observational/pds:Array_3D_Image/pds:offset"

XML_SWAP_SCRIPT_DIR="$V2JBIN"
XML_SWAP_SCRIPT_FILE="xml_swap.py"
XML_SWAP_SCRIPT="${XML_SWAP_SCRIPT_DIR}/${XML_SWAP_SCRIPT_FILE}"

XML_SWAP_TARGET_XML="$XCODER_OUT_XML"
XML_SWAP_SOURCE_XML="$GDAL_RENAMED_XML"
XML_SWAP_OUTPUT_XML="${OUTPUT_DIR}/${FILENAME_IMG}.xmlswap.xml"


## register our temp files for removal
TEMP_FILES+=("$XML_SWAP_OUTPUT_XML")

#XML_SWAP_TARGET_XPATH="//pds:File_Area_Observational" ## Back when we copied the whole chunk...
XML_SWAP_TARGET_XPATH="$XPATH_PO_FAOS_ARRAY_3D_OFFSET" #default for xcode label
XML_SWAP_SOURCE_XPATH="$XPATH_PO_FAOS_ARRAY_3D_OFFSET" #constant for gdal label (maybe?)

## Check for Array_#D's (without namespace), error out it not found
if grep -q "Array_3D_Image" "$XML_SWAP_TARGET_XML"; then
    XML_SWAP_TARGET_XPATH="$XPATH_PO_FAOS_ARRAY_3D_OFFSET"
elif grep -q "Array_2D_Image" "$XML_SWAP_TARGET_XML"; then
    XML_SWAP_TARGET_XPATH="$XPATH_PO_FAOS_ARRAY_2D_OFFSET"
else
    echo "Error: '$XML_SWAP_TARGET_XML' contains neither 'Array_2D_Image' nor 'Array_3D_Image'" >&2
    exit 1
fi

log_debug "Running Python XML swapper script..."

XMLSWAP_PYTHON_CMD=(
    "python"
    "$XML_SWAP_SCRIPT"
    "$XML_SWAP_TARGET_XML"
    "$XML_SWAP_TARGET_XPATH"
    "$XML_SWAP_SOURCE_XML"
    "$XML_SWAP_OUTPUT_XML"
    "$XML_SWAP_SOURCE_XPATH"
)
## Include the --debug flag as well?
if [ "$DEBUG_MODE" = "true" ]; then
    XML_SWAP_OPTIONS+=("--debug")
fi


log_and_execute_cmd --out "$logexec_output_stream" "${XMLSWAP_PYTHON_CMD[@]}"

if [ $? -ne 0 ]; then
    echo "Python script '$XML_SWAP_SCRIPT' failed." >&2
    exit 1
fi
if [ ! -f "$XML_SWAP_OUTPUT_XML" ]; then
    echo "Error: '$XML_SWAP_OUTPUT_XML' was not found after running $XML_SWAP_SCRIPT_FILE." >&2
    exit 1
fi

log_debug "...swapped XML for finalized TIF PDS4 label."

## at this point $XML_SWAP_OUTPUT_XML is our prized PDS4 label,
## so copy it (so we still have swp version in retain-mode)
cp "$XML_SWAP_OUTPUT_XML" "$MAIN_OUTPUT_XML"

## ==================================================================
## ==================================================================
## Report "Mission Accomplished"

log_debug "TIF: $MAIN_OUTPUT_TIF"
log_debug "XML: $MAIN_OUTPUT_XML"
exit 0

