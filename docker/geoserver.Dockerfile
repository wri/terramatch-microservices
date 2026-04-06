FROM docker.osgeo.org/geoserver:2.28.x

# contains cors configuration
COPY docker/geoserver/web.xml /usr/local/tomcat/webapps/geoserver/WEB-INF/web.xml
