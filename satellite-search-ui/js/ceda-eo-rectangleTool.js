/**
 * Created by Richard Smith on 25/07/2017.
 *
 * Gathers all the functions which handle the rectangle tool.
 */




function rectBounds() {
    // Returns [[NW], [SE]] bounds array
    current_bounds = window.rectangle.getBounds();
    var ne = current_bounds.getNorthEast();
    var sw = current_bounds.getSouthWest();

    return [[sw.lng(), ne.lat()], [ne.lng(), sw.lat()]]
}

function queryRect(map) {
    // create ES request, send and draw results.
    var request = createElasticsearchRequest(rectBounds(), $('#ftext').val(), 100, true);
    sendElasticsearchRequest(request, updateMap, map);

    // zoom map to new rectangle
    map.fitBounds(current_bounds);
    map.setZoom(map.getZoom() - 1);
}

function clearRect() {
    // Clears rectangle bounding box from the map.
    window.rectangle.setMap(null);
    window.rectangle = undefined;
    window.DATELINECROSSING = false;
    // Clear rectangle corner position
    document.getElementById('NW').innerHTML = '';
    document.getElementById('SE').innerHTML = '';

}

function datelineCheck(lng1,lng2){
    // Check if longitude coordinates cross the dateline
    if (Math.sign(lng1) !== Math.sign(lng2)){
        // Make sure that the absolute difference is greater than 180 so that it is the date line and not
        // the meridian we are crossing.
        if (Math.abs(lng1 - lng2) > 180){
            return true
        }
    }
    return false
}

// Handles events when toggling on the rectangle tool.
$('#polygon_draw').change(
    function () {

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
            for (i = 0; i < geometries.length; i += 1) {
                geom = geometries[i];
                geom.setMap(null)
            }

            glomap.setOptions({'draggable': false});
            glomap.setOptions({'keyboardShortcuts': false});

            var dragging = false;
            var rect;

            rect = new google.maps.Rectangle({
                map: glomap
            });

            google.maps.event.addListener(glomap, 'mousedown', function (mEvent) {
                // Close instruction panel if open
                $('#collapsePolygonInstructions').collapse('hide');
                DATELINECROSSING = false
                glomap.draggable = false;
                latlng1 = mEvent.latLng;
                dragging = true;
                pos1 = mEvent.pixel;
            });

            google.maps.event.addListener(glomap, 'mousemove', function (mEvent) {
                latlng2 = mEvent.latLng;
                showRect();
            });

            google.maps.event.addListener(glomap, 'mouseup', function (mEvent) {
                glomap.draggable = true;
                dragging = false;

            });

            google.maps.event.addListener(rect, 'mouseup', function (data) {
                glomap.draggable = true;
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

                DATELINECROSSING = datelineCheck(ne.lng(),sw.lng())
                
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
            google.maps.event.clearListeners(glomap, 'mousedown');
            google.maps.event.clearListeners(glomap, 'mouseup');
            addBoundsChangedListener(glomap);

            dragging = false;
            glomap.setOptions({draggable: true});
            glomap.keyboardShortcuts = true;

        }

        function showRect() {
            if (dragging) {
                if (rect === undefined) {
                    rect = new google.maps.Rectangle({
                        map: glomap
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
                // Check if lng coordinate has flipped sign
                DATELINECROSSING = datelineCheck(lng1,lng2)


                if (DATELINECROSSING) {
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
);
