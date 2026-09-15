#!/bin/csh -f
#
# Create a label for a Product_Ancillary text file.  The actual text file
# is not needed.  This is basically the same as label_cal_file.csh but
# doesn't copy the cal file over.
#
# Usage:
#  % label_ancillary_text.csh mission bundle collection filename "descr"
#
# mission is NSYT, MSAM, etc.
# bundle is the bundle name for the LID
# collection is the collection name for the LID
# filename is the name of the text file (lowercase version becomes also the LID)
# descr is the description of the file to use.
#
if ($#argv != 5) then
   head -15 $0
   exit
endif

set mission = $1
set bundle = $2
set collection = $3
set filename = $4
set descr = "$5"
## set sis = "$6"

set code = $V2TEMPLATES/

set name = ${filename:r:t}
set ext = ${filename:e}

## default file and PDS4 label extensions (maybe overwrite next)
set dotext = ".${ext}"
set pds4ext = ".{$ext}.xml"

# Temp files
mkdir /tmp/$$
set json = /tmp/$$/${name}${dotext}.json
set imgtmp = /tmp/$$/${name}${dotext}.tmpvic
endif

# Output files
set outlbl =  ${name}${pds4ext}

# Create json label for transcoder.  Ironically, we don't need to see the
# actual text file itself.  But we do need to see the image.

echo '{' >$json
echo '  "INSTRUMENT_HOST_ID": "'$mission'",' >>$json
echo '  "BUNDLE": "'$bundle'",' >>$json
echo '  "LID_COLLECTION": "'$collection'",' >>$json
echo '  "FILENAME": "'${name}${dotext}'",' >>$json
echo '  "TITLE": "'"$descr"'",' >>$json
## echo '  "SIS_LID": "'$sis'"' >>$json
echo '  "PRODUCT_CLASS" : "Ancillary",' >>$json
echo '  "FILE_AREA_CLASS" : "Ancillary"' >>$json
echo '}' >>$json

# Create dummy (placeholder) vicar file

cp $V2JBIN/LabelocityDummyImage.VIC $imgtmp

# Now call the transcoder to do the work... it uses cal_file_text.vm
# even though this is not a cal file.

set templ = $code/cal_file_text.vm

java -Xmx256M jpl.mipl.io.jConvertIIO PDS_DETACHED_ONLY=true PDS_LABEL_TYPE=PDS4 ri-true format=pds4 inp=$imgtmp out=$outlbl velo_template=$templ extra_file_name=$json extra_file_type=json

# remove temp files

rm $json
rm $imgtmp
rmdir /tmp/$$

endif

