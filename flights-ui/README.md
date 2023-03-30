FLIGHTS UI
========

This repository holds the web interface to the CEDA Flight finder project.
A Geospatial and Temporal metadata search system for Airborne Measurement data.


This web UI uses XML HttpRequest to make elasticsearch requests to elasticsearch.ceda.ac.uk. 
Alternatives include using the [ceda-di](https://github.com/cedadev/ceda-di) service
for ease of use and manipulation via python.

Latest Improvements:
 - Refactored User Interface with Flight/Aircraft/Instrument Search.
 - Updated Elasticsearch Functionality to es7.
 - Added keywords and user-friendly details to flight info windows.
 - Flight displays not per-file structure on backend ES index.

Next steps for improvement:
 - Fix ES rectangle search function