/*jslint browser: true, devel: true, sloppy: true*/
/*global google, $, GeoJSON*/

// -----------------------------------Utils-----------------------------------
function formatDate(dt){
    var time, date;
    var df, dfor;
    time = dt.split('T')[1];
    date = dt.split('T')[0];

    df = date.split('-');
    dfor = df[2] + '/' + df[1] + '/' + df[0];

    return time + ' ' + dfor;
}

function formatDates(start, end, content){
    var times, df, dfor
    // Format start and end times
    if (start.split('T')[0] == end.split('T')[0]){
        // Same date
        times = start.split('T')[1] + ' - ' + end.split('T')[1];
        df = start.split('T')[0].split('-');
        dfor = df[2] + '/' + df[1] + '/' + df[0]; 

        content += '<p><strong>Flight Time: </strong>' +
                    times + '</p>' +
                    '<p><strong>Date: </strong>' +
                    dfor + '</p>';
    }
    else {
        // Write as start and end times
        content += '<p><strong>Start Time: </strong>' +
                   formatDate(start) + '</p>' +
                   '<p><strong>End Time: </strong>' +
                   formatDate(end) + '</p>';
    }
    return content
}


function getParameterByName(name) {
    // Function from: http://stackoverflow.com/a/901144
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'),
        results = regex.exec(location.search);
    if (!results) {
        return null;
    }
    return decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Window constants
//const ES_HOST = 'https://elasticsearch.ceda.ac.uk/'
const ES_HOST = 'https://es9.ceda.ac.uk:9200/'
var REQUEST_SIZE = 400;
var INDEX = "stac-flightfinder-items"; //getParameterByName('index') || 'eufar';
var ES_URL = ES_HOST + INDEX + '/_search';
var TRACK_COLOURS = [
    '#4D4D4D', '#5DA5DA', '#FAA43A',
    '#60BD68', '#F17CB0', '#B2912F',
    '#B276B2', '#DECF3F', '#F15854'
];

// -----------------------------------String-----------------------------------
String.prototype.hashCode = function () {
    // Please see: http://bit.ly/1dSyf18 for original
    var i, c, hash;

    hash = 0;
    if (this.length === 0) {
        return hash;
    }

    for (i = 0; i < this.length; i += 1) {
        c = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + c;
    }

    return hash;
};

String.prototype.truncatePath = function (levels) {
    // Removes 'levels' directories from a path, e.g.:
    // '/usr/bin/path/to/something/useful'.truncatePath(3);
    //     => '/usr/bin/path
    var parts, t_path;
    parts = this.split('/');
    t_path = parts.slice(0, parts.length - levels).join('/');
    return t_path;
};

// ------------------------------Variable Filter-------------------------------
function clearAggregatedVariables() {
    var select = $('#multiselect').html('');
    select.multiSelect('refresh');
}

function displayAggregatedVariables(aggregations) {
    var select, i, buckets;

    select = $('#multiselect');
    buckets = aggregations.variables.std_name.values.buckets;
    for (i = 0; i < buckets.length; i += 1) {
        select.multiSelect('addOption', {
            value: buckets[i].key,
            text: (buckets[i].key + ' (' + buckets[i].doc_count + ')')
        });
    }
}

function requestFromMultiselect() {
    var i, vars, req;
    req = [];
    vars = $('#multiselect').val();

    if (vars) {
        for (i = 0; i < vars.length; i += 1) {
            req.push(vars[i]);
        }
        return req;
    }
    return '';
}

// ---------------------------- Index Radio Buttons ---------------------------

    var index_selectors = $('.index-select')
    index_selectors.click(function () {
        index_selectors.removeClass('btn-info')
        $(this).addClass('btn-info')
        ES_URL = ES_HOST + $(this).data('index') + '/_search';
        sendHistogramRequest()
        $('#multiselect').empty().multiSelect('refresh')


        redrawMap(map, true)
    })

// ---------------------------'Export Results' Modal---------------------------
function updateExportResultsModal(hits) {
    $('#results').html(JSON.stringify(hits, null, '    '));
}

// -------------------------------ElasticSearch--------------------------------
function requestFromFilters(full_text) {
    var i, ft, req;

    req = [];
    if (full_text.length > 0) {
        ft = full_text.split(' ');
        for (i = 0; i < ft.length; i += 1) {
            req.push(ft[i].toLowerCase());
        }
        return req;
    }
}

function requestFromFlightNum(){
    var fn;
    fn = $('#flightnum').val();
    if (fn.length > 0){
        return fn.split(' ');
    }
}

function datelineCheck(lng1,lng2){
    // If we constrain the first entry to be the western lng point and the second the eastern lng point, then we know if
    // two search areas are required by checking if the west lng is greater than the east lng.
    return (lng1 > lng2)
}


function geo_shapeQuery(envelope) {
    // Abstraction function to build the geo_shape query
    return {
        "geo_shape": {
            "spatial.geometries.search": {
                "shape": {
                    "type": "envelope",
                    "coordinates": envelope
                }
            }
        }
    }
}

function createElasticsearchRequest(gmaps_corners, full_text, size) {
    var i, end_time, tmp_ne, tmp_sw, no_photography, nw,
        se, start_time, request, temporal, tf, vars;

    tmp_ne = gmaps_corners.getNorthEast();
    tmp_sw = gmaps_corners.getSouthWest();
    nw = [tmp_sw.lng(), tmp_ne.lat()];
    se = [tmp_ne.lng(), tmp_sw.lat()];

    // First check to see if the search window crosses the date line
    var envelope_corners = []
    if (datelineCheck(nw[0], se[0])) {
        // We have crossed the date line, need to send the search area into two.
        envelope_corners.push([nw, [180, se[1]]])
        envelope_corners.push([[-180, nw[1]], se])

    } else {
        // Not crossing the date line so can just use the search area.
        envelope_corners.push([nw, se])
    }

    // ElasticSearch request
    request = {
        '_source': {
            'include': [
                'es_id',
                'description_path',
                'collection',
                'geometry.display',
                'properties',
            ]
        },
        'query': {
            'bool': {
                'filter': {
                    'bool': {
                        'must': [
                            {
                                "exists": {
                                    "field": "geometry.display.type"
                                }
                            },
                        ],
                        'must_not': [],
                        'should':[]
                    }
                }
            }
        },
    'aggs' : {
          'variables': {
              'nested':{
                  'path': 'parameters'
              },
              'aggs': {
                  'std_name': {
                      'filter': {
                          'term': {
                              'parameters.name': 'standard_name'
                          }
                      },
                      'aggs': {
                          'values': {
                              'terms':{
                                  'field': 'parameters.value.raw'
                              }
                          }
                      }
                  }
              }
          }
      },
        'size': 400
    };
    var is_push = false;
    // Push the geoshape conditions to the main request.
    if (is_push){
        for (i = 0; i < envelope_corners.length; i++) {
            request.query.bool.filter.bool.should.push(geo_shapeQuery(envelope_corners[i]));
        }

        no_photography = {
            'term': {
                'geometry.display.type': 'point'
            }
        };

        if (!$('#photography_checkbox').prop('checked')) {
            request.query.bool.filter.bool.must_not.push(no_photography);
        }

    // Add other filters from page to query
    /*
    tf = requestFromFilters(full_text);
    if (tf) {
        for (i = 0; i < tf.length; i += 1) {
            request.query.bool.filter.bool.must.push(tf[i]);
        }
    }
    Original code 12/10/2022
    */
        var search_str = "";
        tf = requestFromFilters(full_text);
        if (tf) {
            for (i = 0; i < tf.length; i += 1) {
                if (search_str.length > 0){
                    search_str = search_str.concat(" AND ", tf[i]);
                }
                else{
                    search_str = tf[i];
                }
            }
        }
        vars = requestFromMultiselect();
        if (vars) {
            for (i = 0; i < vars.length; i += 1) {
                if (search_str.length > 0){
                    search_str = search_str.concat(" AND ", vars[i]);
                }
                else{
                    search_str = vars[i];
                }
            }
        }
        if (search_str.length > 0){
            var query_str = {
                "query_string":
                {
                    "query": search_str
                }
            };
            request.query.bool.filter.bool.must.push(query_str);
        }

        fnums = requestFromFlightNum();
        // fnums is an array of flight numbers
        if (fnums){
            request.query.bool.filter.bool.must.push(
                { 
                    "terms":
                    {
                        "properties.flight_num": fnums
                    }
            });
        }

        start_time = $('#start_time').val();
        end_time = $('#end_time').val();
        if (start_time !== '') {
            request.query.bool.filter.bool.must.push({
                "properties.start_datetime":start_time
            });
        }
        if (end_time !== '') {
            request.query.bool.filter.bool.must.push({
                "properties.end_datetime":end_time
            });
        }

        console.log(request);
    }
    return request;
}

function sendElasticsearchRequest(request, callback, gmap) {
    var xhr, response;
    //runElasticRequest('stac-flightfinder-items');
    // Construct and send XMLHttpRequest
    xhr = new XMLHttpRequest();
    xhr.open('POST', ES_URL, true);
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.setRequestHeader("ApiKey","b0cc021feec53216cb470b36bec8786b10da4aa02d60edb91ade5aae43c07ee6")
    var request_str = JSON.stringify(request)
    xhr.send(request_str);
    xhr.onload = function () {
        if (xhr.readyState === 4) {

            response = JSON.parse(xhr.responseText);
            
            if (gmap) {
                callback(response, gmap);
            } else {
                callback(response);
            }
        }
    };
}

function updateMap(response, gmap) {
    if (response.hits) {
        // Update "hits" and "response time" fields
        $('#resptime').html(response.took);
        $('#numresults').html(response.hits.total);

        // Draw flight tracks on a map
        drawFlightTracks(gmap, response.hits.hits);
    }

    if (response.aggregations) {
        // Generate variable aggregation on map and display
        displayAggregatedVariables(response.aggregations);
    }
}

function updateRawJSON(response) {
    updateExportResultsModal(response.hits.hits);
}

function updateFilePaths(response) {
    var h, i, paths;
    h = response.hits.hits;

    paths = [];
    for (i = 0; i < h.length; i += 1) {
        paths.push(h[i]._source.file.path);
    }

    updateExportResultsModal(paths);
}

function updateDownloadPaths(response) {
    var h, i, paths;
    h = response.hits.hits;

    paths = [];
    for (i = 0; i < h.length; i += 1) {
        paths.push('http://data.ceda.ac.uk' + h[i]._source.file.path);
    }

    updateExportResultsModal(paths);
}


// -----------------------------------Map--------------------------------------
var geometries = [];
var info_windows = [];

function centreMap(gmap, geocoder, loc) {
    if (loc !== '') {
        geocoder.geocode(
            {
                address: loc
            },
            function (results, status) {
                if (status === 'OK') {
                    gmap.panTo(results[0].geometry.location);
                } else {
                    alert('Could not find "' + loc + '"');
                }
            }
        );
    }
}

function createInfoWindow(hit) {
    var content, info, index;

    hit = hit._source;

    content = "<section>"
    
    if (hit.properties.flight_num) {
        content += '<p><strong>Flight Number: </strong>' +
                    hit.properties.flight_num 
        content += ' (' + hit.collection.toUpperCase() + ')' + '</p>';
    } else if (hit.properties.pcode) {
        // Probably an arsf flight
        content += '<p><strong>Project Code: </strong>' +
                    hit.properties.pcode[0] +
                    ' (' + hit.collection.toUpperCase() + ')' + '</p>';
    }

    if (hit.properties.aircraft){
        content += '<p><strong>Aircraft: </strong>' +
                    hit.properties.aircraft;
        if (hit.properties.platform) {
            content += ' (' + hit.properties.platform + ')';
        }
        content += '</p>';
    } 

    // Reset content
    content = formatDates(hit.properties.start_datetime, hit.properties.end_datetime, content);

    // crew, altitude
    if (hit.properties.instruments){
        var i;
        content += '<p><strong>Instrument: </strong>' + hit.properties.instruments[0];
        for (i = 1; i < hit.properties.instruments.length; i += 1) {
            content += ',' + hit.properties.instruments[i];
        }
        content += '</p>';
    }

    if (hit.properties.variables){
        var i;
        content += '<p><strong>Variables: </strong>' + hit.properties.variables[0];
        for (i = 1; i < hit.properties.variables.length; i += 1) {
            content += ',' + hit.properties.variables[i];
        }
        content += '</p>';
    }

    // Aircraft, variables, locations, platform, instruments, crew, altitude
    if (hit.properties.location){
        // location is item or array
        var i;
        if (typeof hit.properties.location == 'object'){
            content += '<p><strong>Location: </strong>' + hit.properties.location ;
        } else {
            content += '<p><strong>Locations: </strong>' + hit.properties.location[0];
            for (i = 1; i < hit.properties.location.length; i += 1) {
                content += ',' + hit.properties.location[i];
            }
        }
        if (hit.properties.altitude){
            content += ' (' + hit.properties.altitude + ')';
        }
        content += '</p>';

    }

    // Add crew here

    content += '<p><a target="_blank" href="http://data.ceda.ac.uk' +
               hit.description_path + '">Get data for this flight</a></p>';    

    content += '</section>';
    info = new google.maps.InfoWindow(
        {
            content: content,
            disableAutoPan: false
        }
    );

    return info;
}

function drawFlightTracks(gmap, hits) {
    var colour_index, geom, hit, i, info_window, options, display;

    for (i = 0; i < hits.length; i += 1) {
        hit = hits[i];

        colour_index = (hit.idhash.hashCode() % TRACK_COLOURS.length);
        if (colour_index < 0) {
            colour_index = -colour_index;
        }

        options = {
            strokeColor: TRACK_COLOURS[colour_index],
            strokeWeight: 5,
            strokeOpacity: 0.6
        };

        // Create GeoJSON object
        display = hit.geometry.display;
        geom = GeoJSON(display, options);

        geom.setMap(gmap);

        geometries.push(geom);

        // Construct info window
        info_window = createInfoWindow(hit);
        info_windows.push(info_window);
    }

    for (i = 0; i < geometries.length; i += 1) {
        google.maps.event.addListener(geometries[i], 'click',
            (function (i, e) {
                return function (e) {
                    var j;

                    google.maps.event.clearListeners(gmap, 'idle');

                    for (j = 0; j < info_windows.length; j += 1) {
                        info_windows[j].close();
                    }

                    info_windows[i].setPosition(e.latLng);
                    info_windows[i].open(gmap, null);

                    window.setTimeout(function () {
                        addBoundsChangedListener(gmap);
                    }, 500);
                };
            }
        )(i));
    }
}

function cleanup() {
    var i;

    for (i = 0; i < geometries.length; i += 1) {
        geometries[i].setMap(null);
    }
    geometries = [];

    for (i = 0; i < info_windows.length; i += 1) {
        info_windows[i].close();
    }
    info_windows = [];
}

function redrawMap(gmap, add_listener) {
    var full_text, request;

    cleanup();

    // Draw flight tracks
    full_text = $('#ftext').val();
    request = createElasticsearchRequest(gmap.getBounds(), full_text, REQUEST_SIZE);
    sendElasticsearchRequest(request, updateMap, gmap);

    if (add_listener === true) {
        window.setTimeout(function () {
            addBoundsChangedListener(gmap);
        }, 500);
    }
}

function addBoundsChangedListener(gmap) {
    google.maps.event.addListenerOnce(gmap, 'idle', function () {
        redrawMap(gmap, true);
    });
}

// ---------------------------------Histogram----------------------------------
function drawHistogram(request) {
    var ost, buckets, keys, counts, i;

    ost = request.aggregations.only_sensible_timestamps;
    buckets = ost.docs_over_time.buckets;
    keys = [];
    counts = [];
    for (i = 0; i < buckets.length; i += 1) {
        keys.push(buckets[i].key_as_string);
        counts.push(buckets[i].doc_count);
    }

    $('#date_histogram').highcharts({
        chart: {
            type: 'column',
            height: 200,
            width: document.getElementById('filter').offsetWidth * 0.75
        },
        title: {
            text: ''
        },
        xAxis: {
            categories: keys,
            labels: {
                step: 6,
                rotation: 270,
                useHTML: true
            }
        },
        yAxis: {
            title: {
                text: null
            },
            type: 'logarithmic'
        },
        legend: {
            enabled: false
        },
        plotOptions: {
            column: {
                borderWidth: 0,
                groupPadding: 0,
                pointPadding: 0
            }
        },
        series: [{
            name: 'Number of documents',
            data: counts
        }]
    });
}

function sendHistogramRequest() {
    var req, response, xhr;

    req = {
        'aggs': {
            'only_sensible_timestamps': {
                'filter': {
                    'range': {
                        'temporal.start_time': {
                            'gt': '2000-01-01'
                        }
                    }
                },
                'aggs': {
                    'docs_over_time': {
                        'date_histogram': {
                            'field': 'temporal.start_time',
                            'format': 'MM-yyyy',
                            'interval': 'month',
                            'min_doc_count': 0
                        }
                    }
                }
            }
        },
        'size': 0
    };
    xhr = new XMLHttpRequest();
    xhr.open('POST', ES_URL, true);
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.send(JSON.stringify(req));
    xhr.onload = function (e) {
        if (xhr.readyState === 4) {
            response = JSON.parse(xhr.responseText);
            drawHistogram(response);
        }
    };
}

// ------------------------------window.onload---------------------------------
window.onload = function () {
    var geocoder, lat, lon;

    // Google Maps geocoder and map object
    geocoder = new google.maps.Geocoder();
    map = new google.maps.Map(
        document.getElementById('map'),
        {
            mapTypeId: google.maps.MapTypeId.TERRAIN,
            zoom: 4
        }
    );

    centreMap(map, geocoder, 'Lake Balaton, Hungary');
    google.maps.event.addListener(map, 'mousemove', function (event) {
        // Add listener to update mouse position
        // see: http://bit.ly/1zAfter
        lat = event.latLng.lat().toFixed(4);
        lon = event.latLng.lng().toFixed(4);
		$('#mouse').html(lat + ', ' + lon);
	});

    //------------------------------- Buttons -------------------------------
    $('#flightnum').keypress(
        function (e) {
            var charcode = e.charCode || e.keyCode || e.which;
            if (charcode === 13) {
                cleanup();
                redrawMap(map, false);
                return false;
            }
        }
    );

    $('#ftext').keypress(
        function (e) {
            var charcode = e.charCode || e.keyCode || e.which;
            if (charcode === 13) {
                cleanup();
                redrawMap(map, false);
                return false;
            }
        }
    );
/*
    $('#location').keypress(
        function (e) {
            var charcode = e.charCode || e.keyCode || e.which;
            if (charcode === 13) {
                centreMap(map, geocoder, $('#location').val());
                return false;
            }
        }
    );
        */
    $('#applyfil').click(
        function () {
            cleanup();
            redrawMap(map, false);
        }
    );

    $('#clearfil').click(
        function () {
            $('#start_time').val('');
            $('#end_time').val('');
            $('#ftext').val('');
            $('#flightnum').val('');
            clearAggregatedVariables();
            cleanup();
            redrawMap(map, false);
        }
    );

    //--------------------------- 'Export Results' ---------------------------
    $('#raw_json').click(
        function () {
            var req;
            req = createElasticsearchRequest(map.getBounds(), $('#ftext').val(), 100);
            sendElasticsearchRequest(req, updateRawJSON);
        }
    );

    $('#file_paths').click(
        function () {
            var req;
            sendElasticsearchRequest(req, updateFilePaths);
            req = createElasticsearchRequest(map.getBounds(), $('#ftext').val(), 100);
        }
    );

    $('#dl_urls').click(
        function () {
            var req;
            sendElasticsearchRequest(req, updateDownloadPaths);
            req = createElasticsearchRequest(map.getBounds(), $('#ftext').val(), 100);
        }
    );

    $('#export_modal_close').click(
        function () {
            updateExportResultsModal(null);
        }
    );

    //----------------------------- UI Widgets -------------------------------
    $('#multiselect').multiSelect(
        {
            afterSelect: function () {
                redrawMap(map, false);
            },
            afterDeselect: function () {
                redrawMap(map, false);
            }
        }
    );

    // Kick off help text popovers
    // http://stackoverflow.com/a/18537617
    $('[data-toggle="popover"]').popover({
        'trigger': 'hover',
        'placement': 'top'
    });

    // Datepicker
    picker = $('#datepicker').datepicker({
        autoclose: true,
        format: 'yyyy-mm-dd',
        startView: 2
    });

    // set index buttons based on URL on page load
    index_selectors.removeClass('btn-info')
    $('#' + INDEX).addClass('btn-info')


    // Draw histogram
    sendHistogramRequest();

    // 'Include photography' checkbox
    $('#photography_checkbox').change(function () {
        redrawMap(map, false);
    });

    //---------------------------- Map main loop ------------------------------

     google.maps.event.addListenerOnce(map, 'tilesloaded', function() {
         redrawMap(map, true)
      })
};
