/*jslint browser: true, devel: true, sloppy: true*/
/*global google, $, GeoJSON*/

// Handles map drawing functions such as drawing the polygons on the map, listeners and handles the window.onload event.

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
var REQUEST_SIZE = 1000;
var INDEX = getParameterByName('index') || 'ceda-eo';
var ES_URL = 'https://jasmin-es1.ceda.ac.uk/' + INDEX + '/_search';
var TRACK_COLOURS = [
    '#B276B2', '#5DA5DA', '#FAA43A',
    '#60BD68', '#F17CB0', '#B2912F',
    '#4D4D4D', '#DECF3F', '#F15854'
];
var redraw_pause = false;

// based on the Track Colours
var COLOUR_MAP = {
    "sentinel1": "#B276B2",
    "sentinel2": "#5DA5DA",
    "sentinel3": "#FAA43A",
    "landsat": "#60BD68",
    "other": "#F17CB0"
};
var export_modal_open = false;

// -----------------------------------String-----------------------------------
String.prototype.hashCode = function () {
    // Please see: http://bit.ly/1dSyf18 for original
    var i, c, hash;

    hash = 0;
    if (this.length === 0) {
        return hash;
    }

    for (i = 0; i < this.length; i++) {
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

// Toggle text at top of the filters panel
function toggleText() {
    var sliders = document.getElementsByClassName('slider')
    for (var i = 0; i < sliders.length; i++) {
        sliders[i].classList.toggle('closed')
    }
    var headerCollapse = document.getElementById('headCollapse');
    var hCHTML = headerCollapse.innerHTML;
    headerCollapse.innerHTML = hCHTML === 'Collapse Header' ? 'Expand Header' : 'Collapse Header'

}

// -----------------------------------Map--------------------------------------
var geometries = [];
var info_windows = [];
var quicklooks = [];

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

function colourSelect(mission) {
    // Designates a colour to the polygons based on the satellite mission.
    var colour;
    switch (true) {
        case /sentinel\W1.*/gi.test(mission):
            colour = COLOUR_MAP['sentinel1'];
            break;

        case /sentinel\W2.*/gi.test(mission):
            colour = COLOUR_MAP['sentinel2'];
            break;

        case /sentinel\W3.*/gi.test(mission):
            colour = COLOUR_MAP['sentinel3'];
            break;

        case /landsat/gi.test(mission):
            colour = COLOUR_MAP['landsat'];
            break;

        default:
            colour = COLOUR_MAP['other'];
            break;
    }
    return colour
}

function truncatePole(displayCoords) {
    // Polygons drawn at the poles were wrapping round the globe as google maps mecator projection is limited to 85N/S.
    // Function truncates coordinates to 85 N/S for drawing purposes.

    var i, truncatedCoords = [];
    var truncate = false;

    displayCoords = displayCoords.coordinates[0];
    for (i = 0; i < displayCoords.length; i++) {
        var coords = displayCoords[i];
        var last_coords;

        if (coords[1] > 85) {
            // If co-ordinate traverses >85 N, truncate to 85
            coords[1] = 85.0;

            // Only return the first co-ordinate to cross the threshold
            if (!truncate) {
                truncatedCoords.push(coords)
            }
            truncate = true;
            // Store last coordinate to push when polygon re-enters threshold
            if (truncate) {
                last_coords = coords
            }

        } else if (coords[1] < -85) {
            // If co-ordinate traverses < -85 S, truncate to -85
            coords[1] = -85;

            // Only return the first co-ordinate to cross the threshold
            if (!truncate) {
                truncatedCoords.push(coords)
            }
            truncate = true;
            // Store last coordinate to push when polygon re-enters threshold
            if (truncate) {
                last_coords = coords
            }

        } else {
            // On re-entry, push the last truncated co-ordinate as well as the current
            // non-truncated coordinate
            if (truncate) {
                truncatedCoords.push(last_coords)
            }
            truncate = false;
            truncatedCoords.push(coords)
        }
    }
    truncatedCoords = [truncatedCoords];
    return truncatedCoords
}


function drawFlightTracks(gmap, hits) {
    // Add satellite scene polygons onto the map.

    var colour_index, geom, hit, i, info_window, options, display;

    // Clear old map drawings
    cleanup();

    // only need to pass to truncate filter if map is displaying region north/south of 70N/S
    var mapBounds = gmap.getBounds();
    var truncate;
    if (mapBounds.getNorthEast().lat() > 70 || mapBounds.getSouthWest().lat() < -70) {
        truncate = true
    } else {
        truncate = false
    }

    // Reverse the "hits" array because the ES response is ordered new - old and we want to draw the newest items on top.
    hits.reverse();

    for (i = 0; i < hits.length; i += 1) {
        hit = hits[i];
        hit = hits[i];

        var mission = hit._source.misc.platform.Mission
        options = {
            strokeColor: colourSelect(mission),
            strokeWeight: 5,
            strokeOpacity: 0.6,
            fillOpacity: 0.1,
            zIndex: i
        };

        // Create GeoJSON object
        display = hit._source.spatial.geometries.display;

        // Truncate the polygon coordinates
        if (truncate) {
            display.coordinates = truncatePole(display)
        }

        // Create the polygon
        geom = GeoJSON(display, options);

        geom.setMap(gmap);
        geometries.push(geom);

        // Construct info window
        info_window = createInfoWindow(hit);
        info_windows.push(info_window);
    }

    for (i = 0; i < geometries.length; i += 1) {
        google.maps.event.addListener(geometries[i], 'click',
            (function (i, e, hits) {
                return function (e, hits) {
                    var j;

                    google.maps.event.clearListeners(gmap, 'bounds_changed');

                    for (j = 0; j < info_windows.length; j += 1) {
                        info_windows[j].close();
                    }

                    info_windows[i].setPosition(e.latLng);
                    getQuickLook(info_windows[i], i);
                    info_windows[i].open(gmap, null);

                    window.setTimeout(function () {
                        addBoundsChangedListener(gmap);
                    }, 1000);
                };
            })(i));
    }
}


function cleanup() {
    // removes all map objects
    var i;
    for (i = 0; i < geometries.length; i += 1) {
        geometries[i].setMap(null);
    }
    geometries = [];

    for (i = 0; i < info_windows.length; i += 1) {
        info_windows[i].close();
    }
    info_windows = [];
    quicklooks = [];

}

function redrawMap(gmap, add_listener) {
    var full_text, request;

    // Draw flight tracks
    // full_text = $('#ftext').val();
    request = createElasticsearchRequest(gmap.getBounds(), full_text, REQUEST_SIZE);
    sendElasticsearchRequest(request, updateMap, gmap);

    if (add_listener === true) {
        window.setTimeout(function () {
            addBoundsChangedListener(gmap);
        }, 1000);
    }
}

function updateMap(response, gmap) {
    if (response.hits) {
        // Update "hits" and "response time" fields
        $('#resptime').html(response.took);
        $('#numresults').html(response.hits.total);

        // Draw flight tracks on a map
        drawFlightTracks(gmap, response.hits.hits);

        // Toggle loading modal
        if (!export_modal_open) {
            displayLoadingModal()
        }
    }
    if (response.aggregations) {
        // Generate variable aggregation on map and display
        updateTreeDisplay(response.aggregations, gmap);
    }
}

function addBoundsChangedListener(gmap) {

    google.maps.event.addListenerOnce(gmap, 'bounds_changed', function () {

        if (window.rectangle === undefined)
            redrawMap(gmap, true);
    });
}


// ----------------------------- First Load --------------------------------

$('#applyfil').one('click', function(){
    // When the user clicks apply filters for the first time. Make the map responsive.
    addBoundsChangedListener(glomap)
});

// ------------------------------window.unload---------------------------------


    // makes sure that the drawing tool is always off on page load.
    window.unload = function() {
        document.getElementById$('polygon_draw').checked = false
    };

// ------------------------------window.onload---------------------------------

window.onload = function () {
    var geocoder, lat, lon, map;



    // Google Maps geocoder and map object
    geocoder = new google.maps.Geocoder();
    map = new google.maps.Map(
        document.getElementById('map-container').getElementsByClassName('map')[0],
        {
            mapTypeId: google.maps.MapTypeId.TERRAIN,
            zoom: 3,
        }
    );
    glomap = map

    centreMap(map, geocoder, 'Lake Balaton, Hungary');
    google.maps.event.addListener(map, 'mousemove', function (event) {
        // Add listener to update mouse position
        // see: http://bit.ly/1zAfter
        lat = event.latLng.lat().toFixed(2);
        lon = event.latLng.lng().toFixed(2);
        $('#mouse').html('Lat: ' + lat + ', Lng: ' + lon);
    });

    // set map key colours
    $('#sentinel1Key').css('border-color', COLOUR_MAP['sentinel1']);
    $('#sentinel2Key').css('border-color', COLOUR_MAP['sentinel2']);
    $('#sentinel3Key').css('border-color', COLOUR_MAP['sentinel3']);
    $('#landsatKey').css('border-color', COLOUR_MAP['landsat']);
    $('#otherKey').css('border-color', COLOUR_MAP['other']);


    // Open welcome modal
    var welcomeModal = $('#welcome_modal');

    if (Storage !== undefined) {
        // If HTML5 storage available
        // If the modal has been closed this session do not display the modal
        if (!sessionStorage.welcomeDismissed) {
            welcomeModal.modal('show')
        }

        // When the welcome modal is closed, set the session welcomeDismissed to true to prevent showing the modal on
        // page refresh during the same browser session.
        welcomeModal.on('hidden.bs.modal', function () {
            sessionStorage.welcomeDismissed = true
        });
    } else {
        // HTML5 storage is not available, default to displaying the modal on every page load.
        welcomeModal.modal('show')
    }

    //------------------------------- Buttons -------------------------------
    $('#location_search').click(
        function () {
            centreMap(map, geocoder, $('#location').val());
        }
    );

    $('#ftext').keypress(
        function (e) {
            var charcode = e.charCode || e.keyCode || e.which;
            if (charcode === 13) {
                if (window.rectangle !== undefined) {
                    queryRect(map);
                } else {
                    redrawMap(map, false);
                }
                return false;
            }
        }
    );

    $('#location').keypress(
        function (e) {
            var charcode = e.charCode || e.keyCode || e.which;
            if (charcode === 13) {
                centreMap(map, geocoder, $('#location').val());
                return false;
            }
        }
    );

    $('#applyfil').click(
        function () {
            if (window.rectangle !== undefined) {
                queryRect(map);
            } else {
                redrawMap(map, false);
            }
        }
    );

    $('#clearfil').click(
        function () {
            var tree_menu = $('#tree_menu');
            $('#start_time').val('');
            $('#end_time').val('');
            $('#ftext').val('');
            if (window.rectangle !== undefined) {
                clearRect();
            }

            // Clear the map of objects and initialise the tree to clear the badges.
            cleanup()
            sendElasticsearchRequest(treeRequest(), initTree, false);


            // Check all the options in the tree and make sure they are selected.
            // Checked state has to match selected state.
            if (tree_menu.treeview('getUnselected').length > 0) {
                tree_menu.treeview('checkAll', { silent: true})
                var unselected = tree_menu.treeview('getUnselected'), i;
                for (i = 0; i < unselected.length; i++){
                    tree_menu.treeview('selectNode', [ unselected[i].nodeId, {silent: true}])
                }
            }

            // Make sure the rectangle drawing tool is deactivated.
            $('#polygon_draw').prop('checked', false).change()

        }
    );



    //----------------------------- UI Widgets -------------------------------


    // initialise the treeview
    $('#tree_menu').treeview({
        data: {},
        showBorder: false
    });

    // Kick off help text popovers
    // http://stackoverflow.com/a/18537617
    $('span[data-toggle="popover"]').popover({
        'trigger': 'hover'
    });

    // Datepicker
    var picker = $('#datepicker').datepicker({
        autoclose: true,
        format: 'yyyy-mm-dd',
        startView: 2
    });


    // Draw histogram
    sendHistogramRequest();

    // Add rectangle toggle listener
    $('#polygon_draw').change(rectToolToggle)


    //---------------------------- Map main loop ------------------------------
    google.maps.event.addListenerOnce(map, 'tilesloaded', function () {
        // init Tree
        var bounds, tmp_ne, tmp_sw, nw, se, request;

        bounds = map.getBounds();
        tmp_ne = bounds.getNorthEast();
        tmp_sw = bounds.getSouthWest();
        nw = [tmp_sw.lng(), tmp_ne.lat()];
        se = [tmp_ne.lng(), tmp_sw.lat()];

        sendElasticsearchRequest(treeRequest(), initTree, false);
    });
};
