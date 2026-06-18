<?xml version="1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

    <!-- 
    ============================================================
    ============================================================
     XSLT Transcoder file.
     Input:  MMM PDS Headers
     Output: OPGS Vicar headers
     ============================================================
     ============================================================
    -->



    <!-- 
     ============================================================
     Template for root element
     ============================================================
    -->
	<xsl:template match="/">
		<xsl:apply-templates/>
	</xsl:template>
    
    <!-- 
     ============================================================
     XSLT Variables
     ============================================================
    -->
    <xsl:variable name="smallcase" select="'abcdefghijklmnopqrstuvwxyz'" />
    <xsl:variable name="uppercase" select="'ABCDEFGHIJKLMNOPQRSTUVWXYZ'" />
    
    <!-- 
     ============================================================
     Template for PDS_LABEL element
     ============================================================
    -->
	<xsl:template match="PDS_LABEL">
		<VICAR_LABEL>
			<xsl:apply-templates select="./item"/>
			<xsl:apply-templates select="COMMENT"/>
			<xsl:apply-templates select="GROUP"/>
			<xsl:call-template   name="addSITE_DERIVED_GEOMETRY_PARMS" />
			<xsl:call-template   name="addCOMPRESSION_PARMS" />
			<xsl:apply-templates select="OBJECT"/>
			
			<xsl:apply-templates select="//OBJECT[@name='IMAGE']"/>
                       
			<!-- 
			<xsl:apply-templates select="//OBJECT[@name='IMAGE']"/>
			<xsl:apply-templates select="//OBJECT[@name='UNCOMPRESSED_FILE']/OBJECT[@name='IMAGE']"/>
			-->
		</VICAR_LABEL>
	</xsl:template>


    <!-- 
     ============================================================
     Template for COMMENT elements
     ============================================================
    -->
	<xsl:template match="COMMENT">
		<xsl:choose>
        
            <!--
			<xsl:when test=".='/* IDENTIFICATION DATA ELEMENTS */'">
             -->
            <xsl:when test="translate(., $smallcase, $uppercase) = '/* IDENTIFICATION DATA ELEMENTS */'">
			 <xsl:element name="PROPERTY">
			 <xsl:attribute name="name">IDENTIFICATION</xsl:attribute>
             <xsl:apply-templates select="//item[@key='MSL:ACTIVE_FLIGHT_STRING_ID']"/>
			 <xsl:apply-templates select="//item[@key='DATA_SET_ID']"/>
             
             <xsl:call-template name="addPDS_SOURCE_PRODUCT_NODE"/>
             
			 <xsl:apply-templates select="//item[@key='DATA_SET_NAME']"/>
			 <xsl:apply-templates select="//item[@key='COMMAND_SEQUENCE_NUMBER']"/>
			 <xsl:apply-templates select="//item[@key='FRAME_ID']"/>
			 <xsl:apply-templates select="//item[@key='FRAME_TYPE']"/>
			 <xsl:apply-templates select="//item[@key='GEOMETRY_PROJECTION_TYPE']"/>
			 <xsl:apply-templates select="//item[@key='IMAGE_ID']"/>
			 <xsl:apply-templates select="//item[@key='IMAGE_TYPE']"/>
             <xsl:apply-templates select="//item[@key='MSL:IMAGE_ACQUIRE_MODE']"/>
			 <xsl:apply-templates select="//item[@key='INSTRUMENT_HOST_ID']"/>
			 <xsl:apply-templates select="//item[@key='INSTRUMENT_HOST_NAME']"/>
			 <xsl:apply-templates select="//item[@key='INSTRUMENT_ID']"/>
			 <xsl:apply-templates select="//item[@key='INSTRUMENT_NAME']"/>
			 <xsl:apply-templates select="//item[@key='INSTRUMENT_SERIAL_NUMBER']"/>
			 <xsl:apply-templates select="//item[@key='INSTRUMENT_TYPE']"/>
			 <xsl:apply-templates select="//item[@key='INSTRUMENT_VERSION_ID']"/>
             <xsl:apply-templates select="//item[@key='MSL:LOCAL_MEAN_SOLAR_TIME']"/>
			 <xsl:apply-templates select="//item[@key='LOCAL_TRUE_SOLAR_TIME']"/>
			 <xsl:apply-templates select="//item[@key='MAGNET_ID']"/>
			 <xsl:apply-templates select="//item[@key='MISSION_NAME']"/>
			 <xsl:apply-templates select="//item[@key='MISSION_PHASE_NAME']"/>
             <xsl:apply-templates select="//item[@key='VENUE']"/>
			 <xsl:apply-templates select="//item[@key='OBSERVATION_ID']"/>
			 <xsl:apply-templates select="//item[@key='PLANET_DAY_NUMBER']"/>
			 
			 <xsl:call-template name="addPRODUCER_INSTITUTION_NAME"/>
             
			 <xsl:apply-templates select="//item[@key='PRODUCT_CREATION_TIME']"/>
			 
			 <xsl:apply-templates select="//item[@key='PRODUCT_ID']"/>
             <xsl:apply-templates select="//item[@key='SOURCE_PRODUCT_ID']"/>
            
			 <xsl:apply-templates select="//item[@key='PRODUCT_VERSION_ID']"/>
			 <xsl:apply-templates select="//item[@key='RELEASE_ID']"/>
             <xsl:apply-templates select="//item[@key='MSL:REQUEST_ID']"/>
			 <xsl:apply-templates select="//item[@key='ROVER_MOTION_COUNTER']"/>
			 <xsl:apply-templates select="//item[@key='ROVER_MOTION_COUNTER_NAME']"/>
			 <xsl:apply-templates select="//item[@key='SEQUENCE_ID']"/>
			 <xsl:apply-templates select="//item[@key='SEQUENCE_VERSION_ID']"/>
			 <xsl:apply-templates select="//item[@key='SOLAR_LONGITUDE']"/>
			 <xsl:apply-templates select="//item[@key='SPACECRAFT_CLOCK_CNT_PARTITION']"/>
			 <xsl:apply-templates select="//item[@key='SPACECRAFT_CLOCK_START_COUNT']"/>
			 <xsl:apply-templates select="//item[@key='SPACECRAFT_CLOCK_STOP_COUNT']"/>
			 <xsl:apply-templates select="//item[@key='TARGET_TYPE']" />
             <xsl:apply-templates select="//item[@key='IMAGE_TIME']"/>
			 <xsl:apply-templates select="//item[@key='START_TIME']"/>
			 <xsl:apply-templates select="//item[@key='STOP_TIME']"/>
			 <xsl:apply-templates select="//item[@key='TARGET_NAME']"/>
			 
			 <xsl:apply-templates select="//item[@key='MSL:CAMERA_PRODUCT_ID']"/>
			 <xsl:apply-templates select="//item[@key='MSL:CAMERA_PRODUCT_ID_COUNT']"/>
			 
             </xsl:element>
            </xsl:when>
        
        
            <!--
			<xsl:when test=".='/* TELEMETRY DATA ELEMENTS*/'">
             -->
            <xsl:when test="translate(., $smallcase, $uppercase) = '/* TELEMETRY DATA ELEMENTS */'">
			 <xsl:element name="PROPERTY">
			 <xsl:attribute name="name">TELEMETRY</xsl:attribute>
			 <xsl:apply-templates select="//item[@key='APPLICATION_PROCESS_ID']"/>
			 <xsl:apply-templates select="//item[@key='APPLICATION_PROCESS_NAME']"/>
			 <xsl:apply-templates select="//item[@key='APPLICATION_PROCESS_SUBTYPE_ID']"/>
			 <xsl:apply-templates select="//item[@key='EARTH_RECEIVED_START_TIME']"/>
			 <xsl:apply-templates select="//item[@key='EARTH_RECEIVED_STOP_TIME']"/>
			 <xsl:apply-templates select="//item[@key='EXPECTED_PACKETS']"/>
			 <xsl:apply-templates select="//item[@key='PACKET_MAP_MASK']"/>
			 <xsl:apply-templates select="//item[@key='RECEIVED_PACKETS']"/>
			 <xsl:apply-templates select="//item[@key='SPICE_FILE_NAME']"/>
			 <xsl:apply-templates select="//item[@key='TELEMETRY_PROVIDER_ID']"/>
			 <xsl:apply-templates select="//item[@key='TELEMETRY_SOURCE_NAME']"/>
			 <xsl:apply-templates select="//item[@key='TELEMETRY_SOURCE_TYPE']"/>
			 <xsl:apply-templates select="//item[@key='TLM_CMD_DISCREPANCY_FLAG']"/>
			 <xsl:apply-templates select="//item[@key='MSL:TELEMETRY_SOURCE_HOST_NAME']"/>
			 <xsl:apply-templates select="//item[@key='MSL:COMMUNICATION_SESSION_ID']"/>
			 <xsl:apply-templates select="//item[@key='MSL:EXPECTED_TRANSMISSION_PATH']"/>
			 <xsl:apply-templates select="//item[@key='MSL:FLIGHT_SOFTWARE_MODE']"/>
			 <xsl:apply-templates select="//item[@key='FLIGHT_SOFTWARE_VERSION_ID']"/>
			 <xsl:apply-templates select="//item[@key='MSL:PRODUCT_COMPLETION_STATUS']"/>
			 <xsl:apply-templates select="//item[@key='MSL:PRODUCT_TAG']"/>
			 <xsl:apply-templates select="//item[@key='MSL:SEQUENCE_EXECUTION_COUNT']"/>
			 <xsl:apply-templates select="//item[@key='MSL:TELEMETRY_SOURCE_SIZE']"/>
			 <xsl:apply-templates select="//item[@key='TELEMETRY_SOURCE_CHECKSUM']"/>
			 <xsl:apply-templates select="//item[@key='MSL:TELEMETRY_SOURCE_START_TIME']"/>
			 <xsl:apply-templates select="//item[@key='MSL:TELEMETRY_SOURCE_SCLK_START']"/>
			 <xsl:apply-templates select="//item[@key='MSL:STRIPING_COUNT']"/>
			 <xsl:apply-templates select="//item[@key='MSL:STRIPING_OVERLAP_ROWS']"/>
			 <xsl:apply-templates select="//item[@key='MSL:AUTO_DELETE_FLAG']"/>
			 <xsl:apply-templates select="//item[@key='MSL:TRANSMISSION_PATH']"/>
			 <xsl:apply-templates select="//item[@key='MSL:VIRTUAL_CHANNEL_ID']"/>

			 </xsl:element>
			</xsl:when>

	    <!--  
        <xsl:when test="translate(., $smallcase, $uppercase) = '/* HISTORY DATA ELEMENTS */'">
			 <xsl:element name="PROPERTY">
			 <xsl:attribute name="name">PDS_HISTORY</xsl:attribute>
			 <xsl:apply-templates select="//item[@key='PROCESSING_HISTORY_TEXT']"/>
			 <xsl:apply-templates select="//item[@key='SOFTWARE_NAME']"/>
			 <xsl:apply-templates select="//item[@key='SOFTWARE_VERSION_ID']"/>
			 </xsl:element>
		</xsl:when>
		-->
		<xsl:otherwise>
		</xsl:otherwise>
	  </xsl:choose>
	</xsl:template>
	
    
    <!-- 
     ============================================================
     Template for item:INSTRUMENT_ID element
     ============================================================
     -->
	<xsl:template match="//item[@key='INSTRUMENT_ID']">
        <item quoted="false" name="INSTRUMENT_ID" ><xsl:value-of select="normalize-space(.)"/></item>
        <item quoted="false" name="FRAME_ID" >
        <xsl:call-template name="removeSubstring">
            <xsl:with-param name="outputString" select="." />
            <xsl:with-param name="target">MAST_</xsl:with-param>
        </xsl:call-template>
        </item>
        <item name="FRAME_TYPE" quoted="false">STEREO</item>	
	</xsl:template>

    <!-- 
     ============================================================
     Template for item OBJECT[UNCOMPRESSED_FILE]/OBJECT[IMAGE] element
     ============================================================
     -->
    <xsl:template match="OBJECT[@name='UNCOMPRESSED_FILE']/OBJECT[@name='IMAGE']">
     <PROPERTY>
		<xsl:attribute name="name">UNCOMPRESSED_FILE_IMAGE_DATA</xsl:attribute>
		<item quoted="true" name="PROPERTY" >IMAGE_DATA</item>
		<COMMENT>UNCOMPRESSED_FILE_IMAGE_DATA</COMMENT>
		<xsl:apply-templates select="OBJECT"/>
		<xsl:apply-templates/>
		<item name="SAMPLE_BIT_MASK" >2#11111111#</item>
        <xsl:call-template name="addRADIANCE_SETTINGS" />
	  </PROPERTY>
    </xsl:template>
   
    <!-- 
     ============================================================
     Template for item OBJECT[IMAGE] element
     ============================================================
     -->
    <xsl:template match="//OBJECT[@name='IMAGE']">
     <PROPERTY>
		<xsl:attribute name="name">IMAGE_DATA</xsl:attribute>
		<item quoted="true" name="PROPERTY" >IMAGE_DATA</item>
		<xsl:apply-templates select="OBJECT"/>
		<xsl:apply-templates/>
		<xsl:if test="not(//OBJECT[@name='IMAGE']/item[@key='SAMPLE_BIT_MASK'])">
		 <item quoted="false" name="SAMPLE_BIT_MASK" >2#11111111#</item>
		</xsl:if>
        <xsl:call-template name="addRADIANCE_SETTINGS" />
	</PROPERTY>
    
	<!--  not sure if we need the IMAGE OBJECT 
	<PROPERTY>
		<xsl:attribute name="name">IMAGE</xsl:attribute>
		<item quoted="true" name="PROPERTY" >IMAGE</item>
		<xsl:apply-templates/>
		<xsl:if test="not(//OBJECT[@name='IMAGE']/item[@key='SAMPLE_BIT_MASK'])">
		 <item quoted="false" name="SAMPLE_BIT_MASK" >2#11111111#</item>
		</xsl:if>
	</PROPERTY>
	-->
    
    </xsl:template>
   

    <!-- 
     ============================================================
     Template for item OBJECT element
     ============================================================
     -->   
	<xsl:template match="OBJECT">
		<!--  LEAVE IN CASE WE LATER DECIDE WE NEED SOME OF THIS JUNK -->
			 <!-- 
				<PDS_OBJECT>
					<xsl:attribute name="name">
						<xsl:value-of select="@name"/>
					</xsl:attribute>
					<xsl:element name="item">
						<xsl:attribute name="name">OBJECT</xsl:attribute>
						<xsl:attribute name="quoted">true</xsl:attribute>
						<xsl:value-of select="@name"/>
					</xsl:element>
					<xsl:apply-templates select="OBJECT"/>
					<xsl:apply-templates/>
				</PDS_OBJECT>
				-->		
	</xsl:template>


    <!-- 
     ============================================================
     Template for item GROUP elements
     ============================================================
     -->
	<xsl:template match="GROUP">
		<xsl:choose>
		<!--  these are GROUPS that will be deleted -->
		  <xsl:when test="@name='DERIVED_IMAGE_PARMS'"> 
		    <!--  eliminate this GROUP - some values are moved to other GROUPS -->
		  </xsl:when>
		  
          <!--  Reinstated...  -->
		  <!-- 
		  <xsl:when test="@name='ZSTACK_REQUEST_PARMS'"> 
		  </xsl:when>
		  
		  <xsl:when test="@name='VIDEO_REQUEST_PARMS'"> 	    
		  </xsl:when>
		  -->
		  
		  <xsl:when test="@name='PROCESSING_PARMS'"> 
		    <!--  eliminate this GROUP  -->
		  </xsl:when>
		  
		  <!--  Reinstated...  -->
		  <!-- 
		  <xsl:when test="@name='VIDEO_PARMS'"> 		  
		  </xsl:when>
		  -->
          
		  <xsl:when test="@name='IMAGE_PARMS'"> 
		    <!--  eliminate this GROUP -->
		  </xsl:when>
	
	    <xsl:otherwise>
		<!--  <PROPERTY-GROUP> -->
		<PROPERTY>
		  <xsl:choose>
		  
		  
		  
		  <xsl:when test="@name='IMAGE_PARMS'">          
			<xsl:attribute name="name">
				<xsl:value-of select="@name"/>
			</xsl:attribute>
			
			<xsl:element name="item">
				<xsl:attribute name="name">PROPERTY</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:value-of select="@name"/>
			</xsl:element>
			<xsl:apply-templates select="GROUP"/>
			<xsl:apply-templates/>
			<!--  ADD  -->
			
			<xsl:element name="item">
				<xsl:attribute name="name">BANDS</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:value-of select="//OBJECT[@name='IMAGE']/item[@key='BANDS']"/>
			</xsl:element>	
			<!--  BAYER_MODE no longer needed  
			<xsl:choose>
		     <xsl:when test="//OBJECT[@name='IMAGE']/item[@key='BANDS']=1">  
		         <item quoted="true" name="BAYER_MODE">RAW_BAYER</item>
		     </xsl:when>
		     <xsl:otherwise> 
		         <item quoted="true" name="BAYER_MODE">ONBOARD_COLOR</item>
		     </xsl:otherwise> 
		    </xsl:choose>
		    -->
			
		</xsl:when>
		
		<xsl:when test="@name='INSTRUMENT_STATE_PARMS'">          
			<xsl:attribute name="name">
				<xsl:value-of select="@name"/>
			</xsl:attribute>
			
			<xsl:element name="item">
				<xsl:attribute name="name">PROPERTY</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:value-of select="@name"/>
			</xsl:element>
			<xsl:apply-templates select="GROUP"/>
			<xsl:apply-templates/>
			<!--  ADD  -->
			<item quoted="true" name="DOWNSAMPLE_METHOD">NONE</item>
			<!-- BANDS not needed here 
			<xsl:element name="item">
				<xsl:attribute name="name">BANDS</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:value-of select="//OBJECT[@name='IMAGE']/item[@key='BANDS']"/>
			</xsl:element>	
			-->
			<!--  BAYER_MODE no longer needed  
			<xsl:choose>
		     <xsl:when test="//OBJECT[@name='IMAGE']/item[@key='BANDS']=1">  
		         <item quoted="true" name="BAYER_MODE">RAW_BAYER</item>
		     </xsl:when>
		     <xsl:otherwise> 
		         <item quoted="true" name="BAYER_MODE">ONBOARD_COLOR</item>
		     </xsl:otherwise> 
		    </xsl:choose>
		    -->
			<xsl:if test="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='MSL:FRAME_RATE']" >
			  <xsl:element name="item">
				<xsl:attribute name="name">FRAME_RATE</xsl:attribute>
				<!--  <xsl:attribute name="quoted">false</xsl:attribute> -->
				<xsl:attribute name="quoted">
					<xsl:value-of select="@quoted"/>
				</xsl:attribute>
				<xsl:value-of select="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='MSL:FRAME_RATE']"/>
			  </xsl:element>
		     </xsl:if>
		    <!--IMAGE_PARMS PIXEL_AVERAGING_HEIGHT PIXEL_AVERAGING_WIDTH -->
			<xsl:if test="//GROUP[@name='IMAGE_PARMS']/item[@key='PIXEL_AVERAGING_HEIGHT']" >
              <xsl:element name="item">
				<xsl:attribute name="name">PIXEL_AVERAGING_HEIGHT</xsl:attribute>
				<xsl:attribute name="quoted">false</xsl:attribute>
				<xsl:value-of select="//GROUP[@name='IMAGE_PARMS']/item[@key='PIXEL_AVERAGING_HEIGHT']"/>
			  </xsl:element>
			</xsl:if>
			<xsl:if test="//GROUP[@name='IMAGE_PARMS']/item[@key='PIXEL_AVERAGING_WIDTH']" >
			  <xsl:element name="item">
				<xsl:attribute name="name">PIXEL_AVERAGING_WIDTH</xsl:attribute>
				<xsl:attribute name="quoted">false</xsl:attribute>
				<xsl:value-of select="//GROUP[@name='IMAGE_PARMS']/item[@key='PIXEL_AVERAGING_WIDTH']"/>
			  </xsl:element>
			</xsl:if>
			<xsl:if test="//GROUP[@name='PROCESSING_PARMS']/item[@key='DARK_LEVEL_CORRECTION']" >
			  <xsl:element name="item">
				<xsl:attribute name="name">DC_OFFSET</xsl:attribute>
				<xsl:attribute name="quoted">false</xsl:attribute>
				<xsl:value-of select="//GROUP[@name='PROCESSING_PARMS']/item[@key='DARK_LEVEL_CORRECTION']"/>
			  </xsl:element>
			</xsl:if>
			<xsl:if test="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='MSL:MINIMUM_FOCUS_DISTANCE']" >
			  <xsl:element name="item">
				<xsl:attribute name="name">MINIMUM_FOCUS_DISTANCE</xsl:attribute>
				<xsl:attribute name="quoted">false</xsl:attribute>
				<xsl:value-of select="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='MSL:MINIMUM_FOCUS_DISTANCE']"/>
			  </xsl:element>
			</xsl:if>
			<!-- add _UNITS for these -->
			<xsl:if test="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='MSL:MINIMUM_FOCUS_DISTANCE']/@units">
				<xsl:element name="item">
					<xsl:attribute name="name">MINIMUM_FOCUS_DISTANCE__UNIT</xsl:attribute>
					<xsl:value-of select="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='MSL:MINIMUM_FOCUS_DISTANCE']/@units"/>
				</xsl:element>
			</xsl:if>
			
			<xsl:if test="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='MSL:BEST_FOCUS_DISTANCE']" >
			  <xsl:element name="item">
				<xsl:attribute name="name">BEST_FOCUS_DISTANCE</xsl:attribute>
				<xsl:attribute name="quoted">false</xsl:attribute>
				<xsl:value-of select="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='MSL:BEST_FOCUS_DISTANCE']"/>
			  </xsl:element>
			</xsl:if>

			<xsl:if test="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='MSL:BEST_FOCUS_DISTANCE']/@units">
				<xsl:element name="item">
					<xsl:attribute name="name">BEST_FOCUS_DISTANCE__UNIT</xsl:attribute>
					<xsl:value-of select="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='MSL:BEST_FOCUS_DISTANCE']/@units"/>
				</xsl:element>
			</xsl:if>
			
			<xsl:if test="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='MSL:MAXIMUM_FOCUS_DISTANCE']" >
			  <xsl:element name="item">
				<xsl:attribute name="name">MAXIMUM_FOCUS_DISTANCE</xsl:attribute>
				<xsl:attribute name="quoted">false</xsl:attribute>
				<xsl:value-of select="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='MSL:MAXIMUM_FOCUS_DISTANCE']"/>
			  </xsl:element>
			</xsl:if>

			<xsl:if test="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='MSL:MAXIMUM_FOCUS_DISTANCE']/@units">
				<xsl:element name="item">
					<xsl:attribute name="name">MAXIMUM_FOCUS_DISTANCE__UNIT</xsl:attribute>
					<xsl:value-of select="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='MSL:MAXIMUM_FOCUS_DISTANCE']/@units"/>
				</xsl:element>
			</xsl:if>
			
			<xsl:call-template name="addBayerItems">
				<xsl:with-param name="inst_cmprs_mode" select="//GROUP[@name='IMAGE_PARMS']/item[@key='INST_CMPRS_MODE']" />
				<xsl:with-param name="filter_number" select="//GROUP[@name='INSTRUMENT_STATE_PARMS']/item[@key='FILTER_NUMBER']" />
				<xsl:with-param name="instrument_id" select="//item[@key='INSTRUMENT_ID']" />
			</xsl:call-template>
			
		  </xsl:when>   
			
          <xsl:when test="@name='PDS_HISTORY_PARMS'">          
			<xsl:attribute name="name">
				<xsl:call-template name="removeSubstring">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:attribute>
			
			<xsl:element name="item">
				<xsl:attribute name="name">PROPERTY</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:call-template name="globalReplace">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:element>
			<xsl:apply-templates select="GROUP"/>
			<xsl:apply-templates/>
		</xsl:when>
		
		<xsl:when test="@name='GEOMETRIC_CAMERA_MODEL_PARMS'">        
			<xsl:attribute name="name">
				<xsl:call-template name="removeSubstring">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:attribute>
			
			<xsl:element name="item">
				<xsl:attribute name="name">PROPERTY</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:call-template name="globalReplace">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:element>
			<xsl:apply-templates select="GROUP"/>
			<xsl:apply-templates/>
		</xsl:when>
		
		<xsl:when test="@name='ROVER_COORD_SYSTEM_PARMS'">          
			<xsl:attribute name="name">
				<xsl:call-template name="removeSubstring">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:attribute>
			
			<xsl:element name="item">
				<xsl:attribute name="name">PROPERTY</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:call-template name="globalReplace">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:element>
			<xsl:apply-templates select="GROUP"/>
			<xsl:apply-templates/>
			
		</xsl:when>
		
		<xsl:when test="@name='ROVER_COORDINATE_SYSTEM_PARMS'">          
			<xsl:attribute name="name">
				<xsl:call-template name="removeSubstring">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:attribute>
			
			<xsl:element name="item">
				<xsl:attribute name="name">PROPERTY</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:call-template name="globalReplace">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:element>
			<xsl:apply-templates select="GROUP"/>
			<xsl:apply-templates/>
			<xsl:element name="item">
				<xsl:attribute name="name">REFERENCE_COORD_SYSTEM_INDEX</xsl:attribute>
				<xsl:attribute name="quoted">false</xsl:attribute>
				<xsl:value-of select="//GROUP[@name='ROVER_COORDINATE_SYSTEM_PARMS']/item[@key='COORDINATE_SYSTEM_INDEX']/subitem[@key='COORDINATE_SYSTEM_INDEX'][1]"/>
			</xsl:element>	
		</xsl:when>
		
		<xsl:when test="@name='RSM_COORDINATE_SYSTEM_PARMS'">          
			<xsl:attribute name="name">
				<xsl:call-template name="removeSubstring">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:attribute>
			
			<xsl:element name="item">
				<xsl:attribute name="name">PROPERTY</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:call-template name="globalReplace">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:element>
			<xsl:apply-templates select="GROUP"/>
			<xsl:apply-templates/>
			<xsl:element name="item">
				<xsl:attribute name="name">REFERENCE_COORD_SYSTEM_INDEX</xsl:attribute>
				<xsl:apply-templates select="//GROUP[@name='ROVER_COORDINATE_SYSTEM_PARMS']/item[@key='COORDINATE_SYSTEM_INDEX']/subitem"/>
			</xsl:element>	
		</xsl:when>
		
		<xsl:when test="@name='ARM_COORDINATE_SYSTEM_PARMS'">        
			<xsl:attribute name="name">
				<xsl:call-template name="removeSubstring">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:attribute>
			
			<xsl:element name="item">
				<xsl:attribute name="name">PROPERTY</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:call-template name="globalReplace">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:element>
			<xsl:apply-templates select="GROUP"/>
			<xsl:apply-templates/>
			<xsl:element name="item">
				<xsl:attribute name="name">REFERENCE_COORD_SYSTEM_INDEX</xsl:attribute>
				<xsl:apply-templates select="//GROUP[@name='ROVER_COORDINATE_SYSTEM_PARMS']/item[@key='COORDINATE_SYSTEM_INDEX']/subitem"/>
			</xsl:element>	
		</xsl:when>
		
		<xsl:when test="@name='RSM_ARTICULATION_STATE_PARMS'">
			<xsl:attribute name="name">
				<xsl:call-template name="removeSubstring">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:attribute>
			
			<xsl:element name="item">
				<xsl:attribute name="name">PROPERTY</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:call-template name="globalReplace">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:element>
			<xsl:apply-templates select="GROUP"/>
			<xsl:apply-templates/>
		</xsl:when>
		
		<xsl:when test="@name='ARM_ARTICULATION_STATE_PARMS'">
			<xsl:attribute name="name">
				<xsl:call-template name="removeSubstring">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:attribute>
			
			<xsl:element name="item">
				<xsl:attribute name="name">PROPERTY</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:call-template name="globalReplace">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:element>
			<xsl:apply-templates select="GROUP"/>
			<xsl:apply-templates/>
		</xsl:when>
		
		<xsl:when test="@name='CHASSIS_ARTICULATION_STATE_PARMS'">
			<xsl:attribute name="name">
				<xsl:call-template name="removeSubstring">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:attribute>
			
			<xsl:element name="item">
				<xsl:attribute name="name">PROPERTY</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:call-template name="globalReplace">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:element>
			<xsl:apply-templates select="GROUP"/>
			<xsl:apply-templates/>
		</xsl:when>
		
		<xsl:when test="@name='HGA_ARTICULATION_STATE_PARMS'">
			<xsl:attribute name="name">
				<xsl:call-template name="removeSubstring">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:attribute>
			
			<xsl:element name="item">
				<xsl:attribute name="name">PROPERTY</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:call-template name="globalReplace">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:element>
			<xsl:apply-templates select="GROUP"/>
			<xsl:apply-templates/>
		</xsl:when>
		
		<xsl:when test="@name='SITE_COORDINATE_SYSTEM_PARMS'">
			<xsl:attribute name="name">
				<xsl:call-template name="removeSubstring">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:attribute>
			
			<xsl:element name="item">
				<xsl:attribute name="name">PROPERTY</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:call-template name="globalReplace">
					<xsl:with-param name="outputString" select="@name" />
					<xsl:with-param name="target">_PARMS</xsl:with-param>
				</xsl:call-template>
			</xsl:element>
			<xsl:apply-templates select="GROUP"/>
			<xsl:apply-templates/>
			<!-- <NOTE>add REFERENCE_COORD_SYSTEM_INDEX here</NOTE> -->
			<xsl:element name="item">
				<xsl:attribute name="name">REFERENCE_COORD_SYSTEM_INDEX</xsl:attribute>
				<xsl:attribute name="quoted">false</xsl:attribute>
				<xsl:variable name="coord_system_index">
				   <xsl:value-of select="//GROUP[@name='SITE_COORDINATE_SYSTEM_PARMS']/item[@key='COORDINATE_SYSTEM_INDEX']"/>
				</xsl:variable>
				<xsl:value-of select="$coord_system_index - 1"/>
			</xsl:element>
		</xsl:when>	
		
		<xsl:otherwise> <!--  don't remove _PARMS -->
		   <xsl:attribute name="name">
           <xsl:value-of select="@name"/>
           </xsl:attribute>
           
           <xsl:element name="item">
				<xsl:attribute name="name">PROPERTY</xsl:attribute>
				<xsl:attribute name="quoted">true</xsl:attribute>
				<xsl:value-of select="@name"/>
			</xsl:element>
			<xsl:apply-templates select="GROUP"/>
			<xsl:apply-templates/>
		 </xsl:otherwise>
		 </xsl:choose>
		</PROPERTY>
		</xsl:otherwise>
	  </xsl:choose>
	</xsl:template>
    <!--  End of GROUP template -->
    
    
    
    <!-- 
     ============================================================
     Template for item OBJECT/IMAGE element
     ============================================================
     -->
    <xsl:template match="//INSTRUMENT_STATE_PARMS/item[@key='SAMPLE_BIT_MODE_ID']">
        <comment>/* INSTRUMENT_STATE_PARMS/SAMPLE_BIT_MODE_ID = <xsl:value-of select="."/> */</comment>
    </xsl:template>


    <!-- 
     ============================================================
     Template for 'item' elements 
     ============================================================
    -->
	<xsl:template match="item">
	
	  <xsl:choose>
        <xsl:when test="@key='RECORD_TYPE'">
        <comment>/* RECORD_TYPE = <xsl:value-of select="."/> */</comment>
        </xsl:when>
		<xsl:when test="@key='RECORD_BYTES'">
        <comment>/* RECORD_BYTES = <xsl:value-of select="."/> */</comment>
        </xsl:when>
		<xsl:when test="@key='FILE_RECORDS'">
        <comment>/* FILE_RECORDS = <xsl:value-of select="."/> */</comment>
        </xsl:when>
		<xsl:when test="@key='LABEL_RECORDS'">
        <comment>/* LABEL_RECORDS = <xsl:value-of select="."/> */</comment>
        </xsl:when>
        
        <xsl:when test="@key='DARK_LEVEL_CORRECTION'">
          <!-- don't copy here.  moved INSTRUMENT_STATE_PARMS  -->
        </xsl:when>
        <xsl:when test="@key='FIXED_INSTRUMENT_AZIMUTH'">
          <!-- don't copy here.  moved SITE_DERIVED_GEOMETRY_PARMS  -->
        </xsl:when>
        <xsl:when test="@key='FIXED_INSTRUMENT_ELEVATION'">
          <!-- don't copy here.  moved SITE_DERIVED_GEOMETRY_PARMS  -->
        </xsl:when>
        
        <xsl:when test="@key='MSL:MINIMUM_FOCUS_DISTANCE'">
          <!-- don't copy here.  moved INSTRUMENT_STATE_PARMS MSL: removed  -->
        </xsl:when>
        <xsl:when test="@key='MSL:BEST_FOCUS_DISTANCE'">
          <!-- don't copy here.  moved INSTRUMENT_STATE_PARMS MSL: removed  -->
        </xsl:when>
        <xsl:when test="@key='MSL:MAXIMUM_FOCUS_DISTANCE'">
          <!-- don't copy here.  moved INSTRUMENT_STATE_PARMS MSL: removed  -->
        </xsl:when>
        
        
  
        
        
        <xsl:when test="@key='PIXEL_AVERAGING_WIDTH'">
          <!-- don't copy here.  moved INSTRUMENT_STATE else where-->
        </xsl:when>
        <xsl:when test="@key='PIXEL_AVERAGING_HEIGHT'">
          <!-- don't copy here.  moved INSTRUMENT_STATE else where-->
        </xsl:when>
        
        <!--  all of the items to be deleted from the msam label -->
        <xsl:when test="@key='MSL:INVERSE_LUT_FILE_NAME'"></xsl:when>
        <xsl:when test="@key='DATA_SET_NAME'"></xsl:when>
        
        <xsl:when test="@key='MSL:CALIBRATION_FILE_NAME'"></xsl:when>
        <xsl:when test="@key='MSL:TELEMETRY_SOURCE_HOST_NAME'"></xsl:when>
        
        
        
        <!--
        <xsl:when test="@key='MSL:COVER_HALL_SENSOR_FLAG'"></xsl:when>
        <xsl:when test="@key='MSL:LED_STATE_NAME'"></xsl:when>
        <xsl:when test="@key='MSL:LED_STATE_FLAG'"></xsl:when>
        -->
    
        <xsl:when test="@key='DATA_SET_ID'">
        	<xsl:element name="item">
				<xsl:attribute name="name">PDS_SOURCE_PRODUCT_DATA_SET</xsl:attribute>
				<xsl:attribute name="quoted">
					<xsl:value-of select="@quoted"/>
				</xsl:attribute>
				<xsl:value-of select="."/>
			</xsl:element>	
        </xsl:when>
        
        <xsl:when test="@key='MSL:AUTO_FOCUS_ZSTACK_FLAG'">
        	<xsl:element name="item">
				<xsl:attribute name="name">AUTO_FOCUS_ZSTACK_FLAG</xsl:attribute>
				<xsl:attribute name="quoted">
					<xsl:value-of select="@quoted"/>
				</xsl:attribute>
				<xsl:value-of select="."/>
			</xsl:element>	
        </xsl:when>
      
        <xsl:when test="@key='MSL:INSTRUMENT_FOCUS_POSITION_CNT'">
                <xsl:element name="item">
                                <xsl:attribute name="name">INSTRUMENT_FOCUS_POSITION_CNT</xsl:attribute>
                                <xsl:attribute name="quoted">
                                        <xsl:value-of select="@quoted"/>
                                </xsl:attribute>
                                <xsl:value-of select="."/>
                        </xsl:element>
        </xsl:when>
        <xsl:when test="@key='MSL:INSTRUMENT_FOCUS_STEP_SIZE'">
                <xsl:element name="item">
                                <xsl:attribute name="name">INSTRUMENT_FOCUS_STEP_SIZE</xsl:attribute>
                                <xsl:attribute name="quoted">
                                        <xsl:value-of select="@quoted"/>
                                </xsl:attribute>
                                <xsl:value-of select="."/>
                        </xsl:element>
        </xsl:when>
        <xsl:when test="@key='MSL:INSTRUMENT_FOCUS_STEPS'">
                <xsl:element name="item">
                                <xsl:attribute name="name">INSTRUMENT_FOCUS_STEPS</xsl:attribute>
                                <xsl:attribute name="quoted">
                                        <xsl:value-of select="@quoted"/>
                                </xsl:attribute>
                                <xsl:value-of select="."/>
                        </xsl:element>
        </xsl:when>



        <!-- Rules to remove the following items from the IMAGE group: 
             MEAN,MEDIAN,MAXIMUM,MINIMUM,STANDARD_DEVIATION,CHECKSUM,
             BANDS,LINE_SAMPLES             
        -->        
        <xsl:when test="@key='MEAN'">
            <!-- check parent name  <GROUP name="IMAGE"> -->
            <xsl:choose>
                    <xsl:when test="../@name='IMAGE'">
                            <!-- <NOTE>remove MEAN in IMAGE </NOTE>   -->
                    </xsl:when>
                    <xsl:otherwise>
                        <xsl:element name="item">
                            <xsl:attribute name="name">
                                <xsl:value-of select="@key"/>
                            </xsl:attribute>
                            <xsl:attribute name="quoted">
                                <xsl:value-of select="@quoted"/>
                            </xsl:attribute>
                            <xsl:value-of select="."/>
                        </xsl:element>
                    </xsl:otherwise>
             </xsl:choose>
        </xsl:when>
        <xsl:when test="@key='MEDIAN'">
            <!-- check parent name  <GROUP name="IMAGE"> -->
            <xsl:choose>
                    <xsl:when test="../@name='IMAGE'">
                            <!-- <NOTE>remove MEDIAN in IMAGE </NOTE>   -->
                    </xsl:when>
                    <xsl:otherwise>
                        <xsl:element name="item">
                            <xsl:attribute name="name">
                                <xsl:value-of select="@key"/>
                            </xsl:attribute>
                            <xsl:attribute name="quoted">
                                <xsl:value-of select="@quoted"/>
                            </xsl:attribute>
                            <xsl:value-of select="."/>
                        </xsl:element>
                    </xsl:otherwise>
             </xsl:choose>
        </xsl:when>
        <xsl:when test="@key='MAXIMUM'">
            <!-- check parent name  <GROUP name="IMAGE"> -->
            <xsl:choose>
                    <xsl:when test="../@name='IMAGE'">
                            <!-- <NOTE>remove MAXIMUM in IMAGE </NOTE>   -->
                    </xsl:when>
                    <xsl:otherwise>
                        <xsl:element name="item">
                            <xsl:attribute name="name">
                                <xsl:value-of select="@key"/>
                            </xsl:attribute>
                            <xsl:attribute name="quoted">
                                <xsl:value-of select="@quoted"/>
                            </xsl:attribute>
                            <xsl:value-of select="."/>
                        </xsl:element>
                    </xsl:otherwise>
             </xsl:choose>
        </xsl:when>
        <xsl:when test="@key='MINIMUM'">
            <!-- check parent name  <GROUP name="IMAGE"> -->
            <xsl:choose>
                    <xsl:when test="../@name='IMAGE'">
                            <!-- <NOTE>remove MINIMUM in IMAGE </NOTE>   -->
                    </xsl:when>
                    <xsl:otherwise>
                        <xsl:element name="item">
                            <xsl:attribute name="name">
                                <xsl:value-of select="@key"/>
                            </xsl:attribute>
                            <xsl:attribute name="quoted">
                                <xsl:value-of select="@quoted"/>
                            </xsl:attribute>
                            <xsl:value-of select="."/>
                        </xsl:element>
                    </xsl:otherwise>
             </xsl:choose>
        </xsl:when>
        <xsl:when test="@key='STANDARD_DEVIATION'">
            <!-- check parent name  <GROUP name="IMAGE"> -->
            <xsl:choose>
                    <xsl:when test="../@name='IMAGE'">
                            <!-- <NOTE>remove STANDARD_DEVIATION in IMAGE </NOTE>   -->
                    </xsl:when>
                    <xsl:otherwise>
                        <xsl:element name="item">
                            <xsl:attribute name="name">
                                <xsl:value-of select="@key"/>
                            </xsl:attribute>
                            <xsl:attribute name="quoted">
                                <xsl:value-of select="@quoted"/>
                            </xsl:attribute>
                            <xsl:value-of select="."/>
                        </xsl:element>
                    </xsl:otherwise>
             </xsl:choose>
        </xsl:when>
        <xsl:when test="@key='CHECKSUM'">
            <!-- check parent name  <GROUP name="IMAGE"> -->
            <xsl:choose>
                    <xsl:when test="../@name='IMAGE'">
                            <!-- <NOTE>remove CHECKSUM in IMAGE </NOTE>   -->
                    </xsl:when>
                    <xsl:otherwise>
                        <xsl:element name="item">
                            <xsl:attribute name="name">
                                <xsl:value-of select="@key"/>
                            </xsl:attribute>
                            <xsl:attribute name="quoted">
                                <xsl:value-of select="@quoted"/>
                            </xsl:attribute>
                            <xsl:value-of select="."/>
                        </xsl:element>
                    </xsl:otherwise>
             </xsl:choose>
        </xsl:when>
        <xsl:when test="@key='BANDS'">
            <!-- check parent name  <GROUP name="IMAGE"> -->
            <xsl:choose>
                    <xsl:when test="../@name='IMAGE'">
                            <!-- <NOTE>remove BANDS in IMAGE </NOTE>   -->
                    </xsl:when>
                    <xsl:otherwise>
                        <xsl:element name="item">
                            <xsl:attribute name="name">
                                <xsl:value-of select="@key"/>
                            </xsl:attribute>
                            <xsl:attribute name="quoted">
                                <xsl:value-of select="@quoted"/>
                            </xsl:attribute>
                            <xsl:value-of select="."/>
                        </xsl:element>                                                
                    </xsl:otherwise>
             </xsl:choose>
        </xsl:when>       
        
        <xsl:when test="@key='LINE_SAMPLES'">
            <!-- check parent name  <GROUP name="IMAGE"> -->
            <xsl:choose>
                    <xsl:when test="../@name='IMAGE'">
                            <!-- <NOTE>remove LINE_SAMPLES in IMAGE </NOTE>   -->
                    </xsl:when>
                    <xsl:otherwise>
                        <xsl:element name="item">
                            <xsl:attribute name="name">
                                <xsl:value-of select="@key"/>
                            </xsl:attribute>
                            <xsl:attribute name="quoted">
                                <xsl:value-of select="@quoted"/>
                            </xsl:attribute>
                            <xsl:value-of select="."/>
                        </xsl:element>
                    </xsl:otherwise>
             </xsl:choose>
        </xsl:when>
        

        <!-- Comment out by nttoole on July 16, 2019 -->
        <!-- 
        <xsl:when test="@key='IMAGE_ID'">
        	<xsl:element name="item">
				<xsl:attribute name="name">
					<xsl:value-of select="@key"/>
				</xsl:attribute>
				<xsl:attribute name="quoted">
					<xsl:value-of select="@quoted"/>
				</xsl:attribute>
				<xsl:value-of select="//item[@key='MSL:CAMERA_PRODUCT_ID']"/>	
			</xsl:element>			
        </xsl:when>
        --> 

        <xsl:when test="@key='PRODUCT_ID'">
        	<xsl:element name="item">
				<xsl:attribute name="name">
					<xsl:value-of select="@key"/>
				</xsl:attribute>
				<xsl:attribute name="quoted">
					<xsl:value-of select="@quoted"/>
				</xsl:attribute>
				<xsl:value-of select="."/>
			</xsl:element>
			<xsl:element name="item">
				<xsl:attribute name="name">PDS_SOURCE_PRODUCT_ID</xsl:attribute>
				<xsl:attribute name="quoted">
					<xsl:value-of select="@quoted"/>
				</xsl:attribute>
				<xsl:value-of select="."/>
			</xsl:element>
        </xsl:when>
        
        <xsl:when test="@key='FILTER_NAME'">
        	<!-- check parent name  <GROUP name="GEOMETRIC_CAMERA_MODEL_PARMS"> -->
        	<xsl:choose>
	        	<xsl:when test="../@name='GEOMETRIC_CAMERA_MODEL_PARMS'">                
	        		<!-- <NOTE>remove FILTER_NAME in GEOMETRIC_CAMERA_MODEL_PARMS </NOTE>   -->
	        	</xsl:when>
	        	<xsl:otherwise>
		        	<xsl:element name="item">
						<xsl:attribute name="name">
							<xsl:value-of select="@key"/>
						</xsl:attribute>
						<xsl:attribute name="quoted">
							<xsl:value-of select="@quoted"/>
						</xsl:attribute>
						<xsl:value-of select="."/>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
        </xsl:when>
        
        <xsl:when test="@key='BAYER_MODE'">
        	<!-- check parent name  <GROUP name="INSTRUMENT_STATE_PARMS"> could just always not copy it ?? -->
        	<!--  BAYER_MODE is NOT in the input label> I was setting it bssed on other values. no longer needed -->
        	<xsl:choose>
	        	<xsl:when test="../@name='INSTRUMENT_STATE_PARMS'">
	        		<!-- <NOTE>remove BAYER_MODE from INSTRUMENT_STATE_PARMS </NOTE>   -->
	        	</xsl:when>
	        	<xsl:otherwise>
		        	<xsl:element name="item">
						<xsl:attribute name="name">
							<xsl:value-of select="@key"/>
						</xsl:attribute>
						<xsl:attribute name="quoted">
							<xsl:value-of select="@quoted"/>
						</xsl:attribute>
						<xsl:value-of select="."/>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
        </xsl:when>
 
        <xsl:when test="@key='COORDINATE_SYSTEM_INDEX_NAME'">
        	<!-- check parent name  <GROUP name="GEOMETRIC_CAMERA_MODEL_PARMS"> -->
        	<xsl:choose>
	        	<xsl:when test="../@name='GEOMETRIC_CAMERA_MODEL_PARMS'">
	        		 <!-- <NOTE>remove COORDINATE_SYSTEM_INDEX_NAME in GEOMETRIC_CAMERA_MODEL </NOTE>  -->
	        	</xsl:when>
	        	<xsl:otherwise>
	        	<item>	        	
	        		<xsl:attribute name="name">
						<xsl:value-of select="@key"/>
					</xsl:attribute>
				  <xsl:if test="count(subitem)>0">
					<xsl:apply-templates/>
				  </xsl:if>
				</item>
				</xsl:otherwise>
			</xsl:choose>
        </xsl:when>        


		<xsl:otherwise>
		 <item>
		 <xsl:choose>
		    
		    <xsl:when test="@key='MSL:FOCUS_POSITION_COUNT'">
                 <xsl:attribute name="name">FOCUS_POSITION_COUNT</xsl:attribute>                 
		    </xsl:when>
		    
            <xsl:when test="@key='MSL:LED_STATE_NAME'">
                 <xsl:attribute name="name">LED_STATE_NAME</xsl:attribute>                 
		    </xsl:when>
            
            <xsl:when test="@key='MSL:LED_STATE_FLAG'">
                 <xsl:attribute name="name">LED_STATE_FLAG</xsl:attribute>                 
		    </xsl:when>
            
            
            <xsl:when test="@key='MSL:COVER_HALL_SENSOR_FLAG'">
                 <xsl:attribute name="name">COVER_HALL_SENSOR_FLAG</xsl:attribute>                 
		    </xsl:when>
            
            
           
            <!--
            <xsl:when test="@key='MSL:INSTRUMENT_FOCUS_POSITION'">
                 <xsl:attribute name="name">FOCUS_POSITION_COUNT</xsl:attribute>                 
		    </xsl:when>
            -->
            
		    <xsl:when test="@key='SAMPLE_BIT_MODE_ID'">
		       <xsl:attribute name="name">
				<xsl:value-of select="@key"/>
			   </xsl:attribute>
		    </xsl:when>
		    
			<xsl:when test="starts-with(@key,'MSL:')">
                <xsl:attribute name="name"><xsl:value-of select="substring(@key, 5)"/></xsl:attribute>
            </xsl:when>
         
            <xsl:when test="starts-with(@key,'^')">
                <xsl:attribute name="name"><xsl:value-of select="substring(@key, 2)"/>__PTR</xsl:attribute>
            </xsl:when>
                
		<xsl:otherwise>
			<xsl:attribute name="name">
				<xsl:value-of select="@key"/>
			</xsl:attribute>
		</xsl:otherwise>
		</xsl:choose>

			<xsl:if test="count(subitem)>0">
				<xsl:apply-templates/>
			</xsl:if>
			<xsl:if test="count(subitem)=0">
				<xsl:choose>
  					<xsl:when test=".='MMM_LUT0'">
							<xsl:attribute name="quoted">
							<xsl:value-of select="@quoted"/>
						</xsl:attribute>MMM_LUT_0</xsl:when>				    
					<xsl:when test="@quoted">
						<xsl:attribute name="quoted">
							<xsl:value-of select="@quoted"/>
						</xsl:attribute>
						<xsl:value-of select="normalize-space(.)"/>
					</xsl:when>
					<xsl:when test="contains(., &quot;'&quot;)">
						<xsl:attribute name="quoted">true</xsl:attribute>
						<xsl:value-of select="normalize-space(substring(., 2, string-length(.)-2 ))"/>
					</xsl:when>
					<xsl:otherwise>
						<xsl:attribute name="quoted">false</xsl:attribute>
						<xsl:value-of select="normalize-space(.)"/>
					</xsl:otherwise>
				</xsl:choose>
			</xsl:if>
		</item>
		</xsl:otherwise>
	   </xsl:choose>
		
		
		
		<xsl:if test="@units!=''">
			<xsl:variable name="key_unit">
			<xsl:choose>
			   <xsl:when test="starts-with(@key,'MSL:')">
                  <xsl:value-of select="substring(@key, 5)"/>
               </xsl:when>
			   <xsl:otherwise>
			     <xsl:value-of select="@key" />
			   </xsl:otherwise>
			   </xsl:choose>
			</xsl:variable>
			
			
			<xsl:variable name="key_unit_parent">
				<xsl:value-of select="local-name(parent::*)" />
			</xsl:variable>
			<xsl:variable name="key_unit_parent_name">
				<xsl:value-of select="parent[@name]" />
			</xsl:variable>
			<xsl:variable name="dotdot_parent_name">
				<xsl:value-of select="../@name" />
			</xsl:variable>

			<xsl:variable name="key_units" select="concat($key_unit,'__UNIT')" />
			
	   		<!--  <ADD_UNIT_ITEM><xsl:value-of select="$key_units" /></ADD_UNIT_ITEM> -->
	   		<xsl:if test="count(subitem)>0">
				<item>
				<xsl:attribute name="name">
                    <xsl:value-of select="$key_units" />
                </xsl:attribute>
				  <xsl:for-each select="node()">
				    <xsl:if test="@units!=''">
					    <subitem>
					    <xsl:attribute name="name">
	                    	<xsl:value-of select="$key_units" />
	                	</xsl:attribute>
					    <xsl:value-of select="@units"/>
					    </subitem>
				    </xsl:if>
				  </xsl:for-each>
				</item>
			</xsl:if>
			<xsl:if test="count(subitem)=0">
			
			   <xsl:choose>
			   <xsl:when test="@key='MSL:MINIMUM_FOCUS_DISTANCE'">
		         <!-- don't add _UNITS here.  moved INSTRUMENT_STATE_PARMS MSL: removed  -->
		       </xsl:when>
		       <xsl:when test="@key='MSL:BEST_FOCUS_DISTANCE'">
		         <!-- don't add _UNITS here.  moved INSTRUMENT_STATE_PARMS MSL: removed  -->
		       </xsl:when>
		       <xsl:when test="@key='MSL:MAXIMUM_FOCUS_DISTANCE'">
		         <!-- don't add _UNITS here.  moved INSTRUMENT_STATE_PARMS MSL: removed  -->
		       </xsl:when>

				<xsl:otherwise>
				<item>
				<xsl:attribute name="name">
                    <xsl:value-of select="$key_units" />
                </xsl:attribute>
				<xsl:value-of select="@units"/>
				</item>
				</xsl:otherwise>
				</xsl:choose>
			</xsl:if>
		</xsl:if>
	</xsl:template>

    
    
    
	<xsl:template match="subitem">
		<xsl:element name="subitem">
            <xsl:choose>
                <xsl:when test="starts-with(@key,'MSL:')">
                    <xsl:attribute name="name"><xsl:value-of select="substring(@key, 5)"/></xsl:attribute>
                </xsl:when>
            <xsl:otherwise>
                <xsl:attribute name="name">
                    <xsl:value-of select="@key"/>
                </xsl:attribute>
            </xsl:otherwise>
            </xsl:choose>
            
			<xsl:if test="@units!=''">
				<!--  
				<xsl:attribute name="unit">
					<xsl:value-of select="@units"/>
				</xsl:attribute>
				-->
			</xsl:if>
			<xsl:choose>
			
				
			    <xsl:when test=".='NOCONTACT'">
					<xsl:attribute name="quoted">
						<xsl:value-of select="@quoted"/>
					</xsl:attribute>
					<xsl:text>NO CONTACT</xsl:text>
				</xsl:when>
			   
				<xsl:when test="@quoted">
					<xsl:attribute name="quoted">
						<xsl:value-of select="@quoted"/>
					</xsl:attribute>
					<xsl:choose>
					  <xsl:when test="contains(.,' &lt;')">
					    <xsl:value-of select="substring-before(., ' &lt;')"/>
					  </xsl:when>
					  <xsl:otherwise>
						<xsl:value-of select="normalize-space(.)"/>
					  </xsl:otherwise>
					</xsl:choose>
				</xsl:when>
				<xsl:when test="contains(., &quot;'&quot;)">
					<xsl:attribute name="quoted">true</xsl:attribute>
					<xsl:value-of select="substring(., 2, string-length(.)-2)"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:attribute name="quoted">false</xsl:attribute>
					<xsl:value-of select="normalize-space(.)"/>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:element>
	</xsl:template>


<!-- 
     Adds radiance scaling factor and offset items.
     Source group:  DERIVED_IMAGE_PARMS
     Source elements: RADIANCE_SCALING_FACTOR, RADIANCE_OFFSET
     If those elements are found:     
        1)  Remove 'RADIANCE_'
        2)  Create new 'item' element with substring name attribute
        3)  Copy value from source element
-->
<xsl:template name="addRADIANCE_SETTINGS">

    <xsl:if test="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='RADIANCE_SCALING_FACTOR']">
        <xsl:element name="item">
				<xsl:attribute name="name">SCALING_FACTOR</xsl:attribute>
				<xsl:attribute name="quoted">false</xsl:attribute>
				<xsl:value-of select="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='RADIANCE_SCALING_FACTOR']"/>
		</xsl:element>	
    </xsl:if>
	<xsl:if test="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='RADIANCE_OFFSET']">
        <xsl:element name="item">
				<xsl:attribute name="name">OFFSET</xsl:attribute>
				<xsl:attribute name="quoted">false</xsl:attribute>
				<xsl:value-of select="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='RADIANCE_OFFSET']"/>
		</xsl:element>	
    </xsl:if>

</xsl:template>





<xsl:template name="addPRODUCER_INSTITUTION_NAME">
<xsl:element name="item">
		<xsl:attribute name="name">PRODUCER_INSTITUTION_NAME</xsl:attribute>
		<xsl:attribute name="quoted">true</xsl:attribute>
		<xsl:text>MSAM - MASTCAM STEREO ANALYSIS AND MOSAICS PROJECT - JET PROPULSION LAB</xsl:text>
	</xsl:element>	
</xsl:template>

<xsl:template name="addPDS_SOURCE_PRODUCT_NODE">
<xsl:element name="item">
		<xsl:attribute name="name">PDS_SOURCE_PRODUCT_NODE</xsl:attribute>
		<xsl:attribute name="quoted">true</xsl:attribute>
		<xsl:text>IMG</xsl:text>
	</xsl:element>	
</xsl:template>

<xsl:template name="addSITE_DERIVED_GEOMETRY_PARMS">

  <xsl:if test="//GROUP[@name='DERIVED_IMAGE_PARMS']">
	<!--  create  new GROUP, move some items into it, only if SITE_DERIVED_GEOMETRY_PARMS is in the input -->
	<PROPERTY name="SITE_DERIVED_GEOMETRY_PARMS">
	<!--  ADD  -->
    <xsl:element name="item">
		<xsl:attribute name="name">INSTRUMENT_AZIMUTH</xsl:attribute>
		<xsl:attribute name="quoted">false</xsl:attribute>
		<xsl:value-of select="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='FIXED_INSTRUMENT_AZIMUTH']"/>
	</xsl:element>	
    <xsl:element name="item">
		<xsl:attribute name="name">INSTRUMENT_ELEVATION</xsl:attribute>
		<xsl:attribute name="quoted">false</xsl:attribute>
		<xsl:value-of select="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='FIXED_INSTRUMENT_ELEVATION']"/>
	</xsl:element>	
	
	<xsl:element name="item">
		<xsl:attribute name="name">SOLAR_AZIMUTH</xsl:attribute>
		<xsl:attribute name="quoted">false</xsl:attribute>
		<xsl:value-of select="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='SOLAR_AZIMUTH']"/>
	</xsl:element>	
	<xsl:element name="item">
		<xsl:attribute name="name">SOLAR_ELEVATION</xsl:attribute>
		<xsl:attribute name="quoted">false</xsl:attribute>
		<xsl:value-of select="//GROUP[@name='DERIVED_IMAGE_PARMS']/item[@key='SOLAR_ELEVATION']"/>
	</xsl:element>	
	
	<!-- REFERENCE_COORD_SYSTEM_NAME         = SITE_FRAME   -->
	<item quoted="false" name="REFERENCE_COORD_SYSTEM_NAME">SITE_FRAME</item>
	<!-- REFERENCE_COORD_SYSTEM_INDEX,  -->
	<xsl:element name="item">
		<xsl:attribute name="name">REFERENCE_COORD_SYSTEM_INDEX</xsl:attribute>
		<xsl:attribute name="quoted">false</xsl:attribute>
		<xsl:value-of select="//GROUP[@name='ROVER_COORDINATE_SYSTEM_PARMS']/item[@key='COORDINATE_SYSTEM_INDEX']/subitem[@key='COORDINATE_SYSTEM_INDEX'][1]"/>
	</xsl:element>	
	
	</PROPERTY>
  </xsl:if>
</xsl:template>

<xsl:template name="addCOMPRESSION_PARMS">

  <xsl:if test="//GROUP[@name='IMAGE_PARMS']">
	<!--  create  new GROUP, move some items into it, only if IMAGE_PARMS is in the input -->
	<PROPERTY name="COMPRESSION_PARMS">
	<!--  ADD  -->
    <xsl:element name="item">
		<xsl:attribute name="name">INST_CMPRS_MODE</xsl:attribute>
		<xsl:attribute name="quoted">false</xsl:attribute>
		<xsl:value-of select="//GROUP[@name='IMAGE_PARMS']/item[@key='INST_CMPRS_MODE']"/>
	</xsl:element>	
	
    <xsl:element name="item">
		<xsl:attribute name="name">INST_CMPRS_NAME</xsl:attribute>
		<xsl:attribute name="quoted">true</xsl:attribute>
		<xsl:value-of select="//GROUP[@name='IMAGE_PARMS']/item[@key='INST_CMPRS_NAME']"/>
	</xsl:element>	
	
	<xsl:element name="item">
		<xsl:attribute name="name">INST_CMPRS_QUALITY</xsl:attribute>
		<xsl:attribute name="quoted">true</xsl:attribute>
		<xsl:value-of select="//GROUP[@name='IMAGE_PARMS']/item[@key='INST_CMPRS_QUALITY']"/>
	</xsl:element>	
	
	</PROPERTY>
  </xsl:if>
</xsl:template>
	

    
<xsl:template name="globalReplace">
  <xsl:param name="outputString"/>
  <xsl:param name="target"/>
  <xsl:param name="replacement"/>
  <xsl:choose>
    <xsl:when test="contains($outputString,$target)">
      <xsl:value-of select="concat(substring-before($outputString,$target),
               $replacement)"/>
      <xsl:call-template name="globalReplace">
        <xsl:with-param name="outputString" 
             select="substring-after($outputString,$target)"/>
        <xsl:with-param name="target" select="$target"/>
        <xsl:with-param name="replacement" 
             select="$replacement"/>
      </xsl:call-template>
    </xsl:when>
    <xsl:otherwise>
      <xsl:value-of select="$outputString"/>
    </xsl:otherwise>
  </xsl:choose>
</xsl:template>

<xsl:template name="removeSubstring">
  <xsl:param name="outputString"/>
  <xsl:param name="target"/>
  <xsl:choose>
    <xsl:when test="contains($outputString,$target)">
       <xsl:variable name="beforeWord">
			<xsl:value-of select="substring-before($outputString,$target)" />
	   </xsl:variable>
	   <xsl:variable name="afterWord">
			<xsl:value-of select="substring-after($outputString,$target)" />
	   </xsl:variable>
	   <xsl:value-of select="concat($beforeWord,$afterWord)"/>
    </xsl:when>
    <xsl:otherwise>
      <xsl:value-of select="$outputString"/>
    </xsl:otherwise>
  </xsl:choose>
</xsl:template>

<xsl:template name="removeEnding">
  <xsl:param name="outputString"/>
  <xsl:param name="target"/>
  <xsl:choose>
    <xsl:when test="contains($outputString,$target)">
	<xsl:value-of select="substring-before($outputString,$target)"/>
    </xsl:when>
    <xsl:otherwise>
		<xsl:value-of select="$outputString"/>
    </xsl:otherwise>
  </xsl:choose>
</xsl:template>

<xsl:template name="addBayerItems">
  <xsl:param name="inst_cmprs_mode"/>
  <xsl:param name="filter_number"/>
  <xsl:param name="instrument_id"/>
  <xsl:variable name="instrument">
	<xsl:value-of select="substring-before($instrument_id,'_')" />
  </xsl:variable>
  <xsl:variable name="side">
	<xsl:value-of select="substring-after($instrument_id,'_')" />
  </xsl:variable>
  <!--  
  <BAYER_COMMENT>
  /* inst_cmprs_mode,filter_number,instrument_id,instrument,side
  <xsl:value-of select="concat($inst_cmprs_mode,', ',$filter_number,', ',$instrument_id,', ',$instrument,', ',$side)"/> */
  </BAYER_COMMENT>
  -->
  <xsl:if test="$inst_cmprs_mode=3">
  	<comment>JPEG</comment>
  	<item quoted="true" name="CFA_TYPE">BAYER_RGGB</item>
  	<item quoted="true" name="CFA_VENUE">ONBOARD</item>
  	<xsl:choose>
    	<xsl:when test="$instrument='MAST'">
    	<xsl:choose>
    		<xsl:when test="$side='LEFT'">
    		  <xsl:choose>
    			<xsl:when test="$filter_number='0'">
    			  <item quoted="true" name="BAYER_METHOD">MALVAR</item>
    			</xsl:when>
    			<xsl:when test="$filter_number='1'">
    			  <item quoted="true" name="BAYER_METHOD">GREEN_BILINEAR</item>
    			</xsl:when>
    			<xsl:when test="$filter_number='2'">
    			  <item quoted="true" name="BAYER_METHOD">BLUE_BILINEAR</item>
    			</xsl:when>
    			<xsl:when test="$filter_number='3'">
    			  <item quoted="true" name="BAYER_METHOD">RED_BILINEAR</item>
    			</xsl:when>
    			<xsl:when test="$filter_number='4'">
    			  <item quoted="true" name="BAYER_METHOD">RED_BILINEAR</item>
    			</xsl:when>
    			<xsl:when test="$filter_number='5'">
    			  <item quoted="true" name="BAYER_METHOD">IDENTITY</item>
    			</xsl:when>
    			<xsl:when test="$filter_number='6'">
    			  <item quoted="true" name="BAYER_METHOD">IDENTITY</item>
    			</xsl:when>
    			<xsl:when test="$filter_number='7'">
    			  <item quoted="true" name="BAYER_METHOD">IDENTITY</item>
    			</xsl:when>
    			<xsl:otherwise>
		  		 <item quoted="true" name="BAYER_METHOD">UNK FILTER</item>
    		    </xsl:otherwise>		
			  </xsl:choose>
    		</xsl:when>
    		<xsl:when test="$side='RIGHT'">
    		  <xsl:choose>
    			<xsl:when test="$filter_number='0'">
    			  <item quoted="true" name="BAYER_METHOD">MALVAR</item>
    			</xsl:when>
    			<xsl:when test="$filter_number='1'">
    			  <item quoted="true" name="BAYER_METHOD">GREEN_BILINEAR</item>
    			</xsl:when>
    			<xsl:when test="$filter_number='2'">
    			  <item quoted="true" name="BAYER_METHOD">BLUE_BILINEAR</item>
    			</xsl:when>
    			<xsl:when test="$filter_number='3'">
    			  <item quoted="true" name="BAYER_METHOD">RED_BILINEAR</item>
    			</xsl:when>
    			<xsl:when test="$filter_number='4'">
    			  <item quoted="true" name="BAYER_METHOD">IDENTITY</item>
    			</xsl:when>
    			<xsl:when test="$filter_number='5'">
    			  <item quoted="true" name="BAYER_METHOD">IDENTITY</item>
    			</xsl:when>
    			<xsl:when test="$filter_number='6'">
    			  <item quoted="true" name="BAYER_METHOD">IDENTITY</item>
    			</xsl:when>
    			<xsl:when test="$filter_number='7'">
    			  <item quoted="true" name="BAYER_METHOD">BLUE_BILINEAR</item>
    			</xsl:when>
    			<xsl:otherwise>
		  		 <item quoted="true" name="BAYER_METHOD">UNK FILTER</item>
    		    </xsl:otherwise>		
			  </xsl:choose>
		
    		</xsl:when>
    		<xsl:otherwise>
		  		<item quoted="true" name="BAYER_METHOD">UNK SIDE</item>
    		</xsl:otherwise>
		</xsl:choose>
    	</xsl:when>
    	<xsl:when test="$instrument='MAHLI'">
			<item quoted="true" name="BAYER_METHOD">MALVAR</item>
    	</xsl:when>
    	<xsl:when test="$instrument='MARDI'">
			<item quoted="true" name="BAYER_METHOD">MALVAR</item>
    	</xsl:when>
    	<xsl:otherwise>
		  <item quoted="true" name="BAYER_METHOD">UNK</item>
    	</xsl:otherwise>
  	</xsl:choose>
  	
  </xsl:if>
  <xsl:if test="not($inst_cmprs_mode=3)">
  	<comment>NOT JPEG</comment>
  	<item quoted="true" name="CFA_TYPE">BAYER_RGGB</item>
  	<item quoted="true" name="CFA_VENUE">NONE</item>
  	<item quoted="true" name="BAYER_METHOD">RAW_BAYER</item>
  </xsl:if>
  <!--  
  <xsl:choose>
    <xsl:when test="contains($outputString,$target)">
	<xsl:value-of select="substring-before($outputString,$target)"/>
    </xsl:when>
    <xsl:otherwise>
		<xsl:value-of select="$outputString"/>
    </xsl:otherwise>
  </xsl:choose>
  -->
</xsl:template>

</xsl:stylesheet>
