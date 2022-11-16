
function createInfoData(){
    // 2x2 latlon squares
    var infodata = [];
    var lat, lon;
    for (var i=0; i<90; i++){
        lat = i*2 - 90;
        for (var j=0; j<180; j++){
            lon = j*2 - 180;
                infodata.push({
                    'lat':lat,
                    'lon':lon,
                    'missions':[],
                    'satellites':[],
                    'instruments':[],
                    'temporal_starts':[],
                    'temporal_ends':[]
                })
        }
    }
    return infodata;
}

function gridInfoBox(){

}

function overlapSquares(){
    
}

// Find turf-intersect and geojson-area

function gridSquareManager(gmap, hits){
    var colour_index, geom, hit, i, info_window, options, display;
    var infodata;

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

    // Create a 2d array to cover the specified area
    // Auto-create Info Window array and add to it with new hits

    infodata = createInfoData();

    for (i = 0; i < hits.length; i += 1) {
        hit = hits[i];

        // Create GeoJSON object
        display = hit._source.spatial.geometries.display;

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