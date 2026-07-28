#!/bin/csh -f
#
# Create a label for a documentation file.
#
# Usage:
#  % label_doc_file.csh mission file bundle collection "descr" "author" "docstd" "edition" version [ title ]
#
# mission: NSYT, MSAM, etc.
# file: docfile to label.
# bundle: the bundle, used in PDS LID 
# collection: the collection, e.g. miscellaneous or document
# descr: description of the file.
# author: author list (Last, F.; Other, S.)
# docstd: document standard id, e.g. "Rich Text", "PDF/A", "7-Bit ASCII Text",
#     "GIF", "HTML", JPEG", "PNG", "TIFF", "UTF-8 Text"
# edition: text for <edition_name>, e.g. "PDF version"
# version: version number, e.g. 1.0
# title: optional title, use desc if not avail
#
# Important note regarding Author.  Starting in IM 1.25 (1P), author_list is
# deprecated, replaced with List_Author.  The template is smart enough to note
# the version and use the right construct.  However, if you want to be
# compatible with the List_Author mechanism, the author string must be
# formatted as a set of names separated by semicolons, and each name is
# Last, First separated by commas.  An optional ORCID can follow first name
# with an additional comma.  So for example we might have:
# "Deen, Robert G., https://orcid.org/0000-0002-5693-641X; Toole, Nicholas"

if ($#argv != 9 && $#argv != 10) then
   head -19 $0
   exit
endif

# setenv CLASSPATH /home/nsytmipl/magic_jars/a_dev_srl_generate-0.14.0.jar:/home/nsytmipl/magic_jars/a_vicario_msl.jar:"$CLASSPATH"

set mission = $1
set docfile = $2
set bundle = "$3"
set collection = "$4"
set descr = "$5"
set author = "$6"
set docstd = "$7"
set edition = "$8"
set version = "$9"
if ($#argv == 10) then
  set title = "$10"
else
  set title = "$descr"
endif

set code = $V2TEMPLATES

# Get the SIS from the mission

set name = ${docfile:r}
set ext = ${docfile:e}

# Preserve xml files
if ("$ext" == "xml") set ext = "xmlx"

## default file and PDS4 label extensions (maybe overwrite next)
set dotext = ".${ext}"
set pds4ext = "${dotext}.xml"

## Handles cases of $docfile having empty or no exten
if ( $docfile =~ "*." ) then
   set dotext = "."
   ## (RGD believes a final '.' should be dropped for PDS4 filename)
   set pds4ext = ".xml"
else if ( "$ext" == "" ) then
   set dotext = ""
   set pds4ext = ".xml"
endif


# Temp files
set json = ${name}${dotext}.json
set imgtmp = ${name}${dotext}.tmpvic

# Output files
set outlbl =  ${name}${pds4ext}

# Create json label for transcoder.  Ironically, we don't need to see the
# actual text file itself.  But we do need to see the image.

echo '{' >$json
echo '  "INSTRUMENT_HOST_ID": "'$mission'",' >>$json
echo '  "FILENAME": "'${name}${dotext}'",' >>$json
echo '  "BUNDLE": "'"$bundle"'",' >>$json
echo '  "COLLECTION": "'"$collection"'",' >>$json
echo '  "DESCRIPTION": "'"$descr"'",' >>$json
echo '  "TITLE": "'"$title"'",' >>$json
echo '  "AUTHOR": "'"$author"'",' >>$json
echo '  "DOCSTD": "'"$docstd"'",' >>$json
echo '  "EDITION": "'"$edition"'",' >>$json
echo '  "VERSION": "'"$version"'"' >>$json
echo '}' >>$json

# Create dummy (placeholder) vicar file

### $R2LIB/gen $imgtmp
cp $V2JBIN/LabelocityDummyImage.VIC $imgtmp

# Now call the transcoder to do the work...

set templ = $code/doc_file.vm

java -Xmx256M jpl.mipl.io.jConvertIIO PDS_DETACHED_ONLY=true PDS_LABEL_TYPE=PDS4 ri-true format=pds4 inp=$imgtmp out=$outlbl velo_template=$templ extra_file_name=$json extra_file_type=json

# remove temp files

rm $json
rm $imgtmp
rm output.xml
rm velocity.log

