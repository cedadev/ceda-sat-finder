FLIGHTS UI
========

This repository holds the web interface to the CEDA Flight finder project.
A Geospatial and Temporal metadata search system for Airborne Measurement data.


This web UI uses XML HttpRequest to make elasticsearch requests to elasticsearch.ceda.ac.uk. 
Alternatives include using the [ceda-di](https://github.com/cedadev/ceda-di) service
for ease of use and manipulation via python.

Suggested next steps for UI improvement:
 - Further info for each flight to aid in keyword search
 - Alter photography inclusion representation (pin overload)
 - Other checkboxes that might be useful?
 - Check numresults as hit count display is ''

Next steps for backend improvement:
 - Move to searching flights not files
   - Multiple files for same flight thus lots of extra lines/overlap
 - Refactor elasticsearch doc (combine existing index docs for equal flights)