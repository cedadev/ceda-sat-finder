function rectBounds() {
    // Returns [[NW], [SE]] bounds array
    current_bounds = window.rectangle.getBounds();

    // Convert to JSON
    let json_bounds = current_bounds.toJSON();

    // return nw, sw in (long,lat) format
    let rect_bounds = [[json_bounds.west, json_bounds.north], [json_bounds.east, json_bounds.south]]

    // There seems to be a bug in the Google API which means that north and south are being incorrectly reported
    if (json_bounds.north < json_bounds.south){
        rect_bounds = [[json_bounds.west, json_bounds.south], [json_bounds.east, json_bounds.north]]
    }

    return rect_bounds
}

function queryRect(map) {
    // create ES request, send and draw results.
    var request = createElasticsearchRequest(rectBounds(), FPOP, true);
    sendElasticsearchRequest(request, updateMap, map);

    // zoom map to new rectangle
    map.fitBounds(current_bounds);
    map.setZoom(map.getZoom() - 1);
}

function clearRect() {
    // Clears rectangle bounding box from the map and resets all associated variables.
    window.rectangle.setMap(null);
    window.rectangle = undefined;
    window.drawDir = undefined;
    // Clear rectangle corner position
    document.getElementById('NW').innerHTML = '';
    document.getElementById('SE').innerHTML = '';

}

function signTest(lng1,lng2){
    // Tests if the signs are equal.
    return Math.sign(lng1) === Math.sign(lng2)
}

function datelineCheck(lng1,lng2){
    // Check if longitude coordinates cross the dateline
    if (!signTest(lng1,lng2)){
        // If we constrain first entry to be western lng point and second to eastern lng point, then we can know if
        // we are on the date line or meridian by which way the sign is changing.
        // On the date line, the western lng is +ve and the eastern is -ve therefore lng1 > lng2
        // On the meridian, the western lng is -ve and the eastern is +ve so if(lng1 > lng2) would be false.
        if (lng1 > lng2){
            return true
        }
    }
    return false
}

// Handles events when toggling on the rectangle tool.
function rectToolToggle (map) {
    var lines, geom;

    if ($('#polygon_draw').prop('checked')) {

        // Show instructions panel if it is closed.
        $('#collapsePolygonInstructions').collapse('show');

        // Open rectangle search panel if not already open. Using the link for the panel title
        // rather than the bootstrap method so that the panel still behaves like an accordian.
        if (!$('#collapse_spatial').hasClass('in')){
            document.getElementById('spatial_accordian').click()
        }

        if (window.rectangle !== undefined) {
            clearRect();
        }

        // Clear all the satellite product objects to allow user to draw.
        for (lines of geometries) {
            for (geom of lines){
                geom.setMap(null);
            }
        }

        map.setOptions({'draggable': false});
        map.setOptions({'keyboardShortcuts': false});

        var dragging = false;
        var rect;

        rect = new google.maps.Rectangle({
            map: map
        });

        google.maps.event.addListener(map, 'mousedown', function (mEvent) {
            // Close instruction panel if open
            $('#collapsePolygonInstructions').collapse('hide');
            drawDir = undefined
            map.draggable = false;
            latlng1 = mEvent.latLng;
            dragging = true;
            // pos1 = mEvent.pixel;
        });

        google.maps.event.addListener(map, 'mousemove', function (mEvent) {
            latlng2 = mEvent.latLng;
            showRect();
        });

        google.maps.event.addListener(map, 'mouseup', function (mEvent) {
            map.draggable = true;
            dragging = false;

        });

        google.maps.event.addListener(rect, 'mouseup', function (data) {
            map.draggable = true;
            dragging = false;

            // Trigger apply filter at the conclusion of the drawing
            $('#applyfil').trigger('click');

            // Allow the user to resize and drag the rectangle at the conclusion of drawing.
            rect.setEditable(true);
            rect.setDraggable(true);
        });

        rect.addListener('bounds_changed',function() {
            var ne = rect.getBounds().getNorthEast();
            var sw = rect.getBounds().getSouthWest();

            // update corner position
            document.getElementById('NW').innerHTML = ' Lat: ' + ne.lat().toFixed(2) + ' Lng: ' + sw.lng().toFixed(2);
            document.getElementById('SE').innerHTML = ' Lat: ' + sw.lat().toFixed(2) + ' Lng: ' + ne.lng().toFixed(2);
        })
    }
    else {
        // Hide instructions panel if it is open.
        $('#collapsePolygonInstructions').collapse('hide');

        // Hide Rectangle Search accordian panel if open.
        $('#collapse_spatial').collapse('hide');

        // clear rectangle drawing listeners and reinstate boundschanged listener.
        google.maps.event.clearListeners(map, 'mousedown');
        google.maps.event.clearListeners(map, 'mouseup');
        addBoundsChangedListener(map);

        dragging = false;
        map.setOptions({draggable: true});
        map.keyboardShortcuts = true;

    }

    function showRect() {
        if (dragging) {
            if (rect === undefined) {
                rect = new google.maps.Rectangle({
                    map: map
                });

            } else {
                rect.setEditable(false)
            }

            // allow rectangle drawing from any angle.
            var lat1 = latlng1.lat();
            var lat2 = latlng2.lat();
            var minLat = lat1 < lat2 ? lat1 : lat2;
            var maxLat = lat1 < lat2 ? lat2 : lat1;

            var lng1 = latlng1.lng();
            var lng2 = latlng2.lng();

            // Handle dateline crossing
            // Determine tthe direction of drawing coordinate.
            if (lng1 < lng2 && drawDir === undefined){
                drawDir = 'east'
            } else if (lng1 > lng2 && drawDir === undefined){
                drawDir = 'west'
            } else if (lng1 < lng2 && signTest(lng1,lng2)){
                drawDir = 'east'
            } else if (lng1 > lng2 && signTest(lng1,lng2)){
                drawDir = 'west'
            }
            // Set the east and west lng coordinate.
            var eastLng,westLng;
            switch (drawDir){
                case 'west':
                    eastLng = lng2;
                    westLng = lng1;
                    break;

                default:
                    eastLng = lng1;
                    westLng = lng2;
                    break;
            }

            if (datelineCheck(lng1,lng2)) {
                // If it has, we have crossed the dateline.
                // If we have crossed the dateline, send different coordinates to latLngBounds object which wrap around earth.
                if (lng1 > lng2){
                    // we are crossing the dateline east
                    lng2 = 180 + (180+lng2)
                }
                else {
                    // we are crossing the date line west
                    lng2 = -180 - (180-lng2)
                }
            }

            var minLng = lng1 < lng2 ? lng1 : lng2;
            var maxLng = lng1 < lng2 ? lng2 : lng1;

            var latLngBounds = new google.maps.LatLngBounds(
                //ne
                new google.maps.LatLng(maxLat, minLng),
                //sw
                new google.maps.LatLng(minLat, maxLng)
            );
            rect.setBounds(latLngBounds);

            // Reset coordinates to normal world coordinates for the text interface.
            if (maxLng > 180){maxLng-= 360}
            if (minLng < -180){ minLng+= 360}
            // Update the rectangle corners in the spatial search pane.
            document.getElementById('NW').innerHTML = ' Lat: ' + maxLat.toFixed(2) + ' Lng: ' + minLng.toFixed(2);
            document.getElementById('SE').innerHTML = ' Lat: ' + minLat.toFixed(2) + ' Lng: ' + maxLng.toFixed(2);

            window.rectangle = rect
        }
    }
}
