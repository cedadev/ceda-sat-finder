/**
 * Created by vdn73631 on 25/07/2017.
 */


// -------------------------------ElasticSearch--------------------------------
// Request JSON

function esRequest(nw, se, size) {
    // Abstracts the actual request from the main active code
    return {
        "_source": {
            "include": [
                "data_format.format",
                "file.filename",
                "file.path",
                "file.data_file",
                "file.quicklook_file",
                "file.location",
                "file.directory",
                "misc",
                "spatial",
                "temporal"
            ]
        },
        "sort": [
            {
                "temporal.start_time": {"order": "desc"}
            },
            "_score"
        ],
        "query": {
            "filtered": {
                "query": {
                    "match_all": {}
                },
                "filter": {
                    "bool": {
                        "must": [
                            {
                                "geo_shape": {
                                    "spatial.geometries.search": {
                                        "shape": {
                                            "type": "envelope",
                                            "coordinates": [nw, se]
                                        }
                                    }
                                }
                            }
                        ],
                        "must_not": [
                            {
                                "missing": {
                                    "field": "spatial.geometries.display.type"
                                }

                            }
                        ]
                    }
                }
            }
        },
        "aggs": {
            "data_count": {
                "terms": {
                    "field": "misc.platform.Satellite.raw"
                }
            },
            "all": {
                "global": {},
                "aggs": {
                    "satellites": {
                        "terms": {
                            "field": "misc.platform.Satellite.raw",
                            "size": 30
                        }
                    }
                }
            }
        },
        "size": size
    };
}

function treeRequest() {
    // Abstracts the actual request from the main active code
    // Simpler, light request just for initialising the tree.
    return {
        "aggs": {
            "data_count": {
                "terms": {
                    "field": "misc.platform.Satellite.raw"
                }
            },
            "all": {
                "global": {},
                "aggs": {
                    "satellites": {
                        "terms": {
                            "field": "misc.platform.Satellite.raw",
                            "size": 30
                        }
                    }
                }
            }
        },
        "size": 0
    };
}

function requestFromFilters(full_text) {
    var i, ft, req;

    req = [];
    if (full_text.length > 0) {
        ft = full_text.split(' ');
        for (i = 0; i < ft.length; i += 1) {
            req.push({
                term: {
                    _all: ft[i].toLowerCase()
                }
            });
        }
        return req;
    }
}

function createElasticsearchRequest(gmaps_corners, full_text, size, drawing) {
    var i, end_time, tmp_ne, tmp_sw, nw,
        se, start_time, request, temporal, tf, vars;

    // Present loading modal
    if (!export_modal_open) {
        displayLoadingModal()
    }

    if (drawing) {
        nw = gmaps_corners[0];
        se = gmaps_corners[1]
    }
    else {

        tmp_ne = gmaps_corners.getNorthEast();
        tmp_sw = gmaps_corners.getSouthWest();
        nw = [tmp_sw.lng().toString(), tmp_ne.lat().toString()];
        se = [tmp_ne.lng().toString(), tmp_sw.lat().toString()];
    }


    // ElasticSearch request
    request = esRequest(nw, se, size);

    // Add other filters from page to query
    // tf = requestFromFilters(full_text);
    // if (tf) {
    //     for (i = 0; i < tf.length; i += 1) {
    //         request.query.filtered.filter.bool.must.push(tf[i]);
    //     }
    // }

    // Tree selection filters.
    vars = requestFromTree();

    if (vars) {
        for (i = 0; i < vars.length; i += 1) {
            request.query.filtered.filter.bool.must_not.push(vars[i]);
        }
    }

    temporal = {
        range: {
            'temporal.start_time': {}
        }
    };

    start_time = $('#start_time').val();
    if (start_time !== '') {
        temporal.range['temporal.start_time'].from = start_time;
    }

    end_time = $('#end_time').val();
    if (end_time !== '') {
        temporal.range['temporal.start_time'].to = end_time;
    }

    if (temporal.range['temporal.start_time'].to !== null ||
        temporal.range['temporal.start_time'].from !== null) {
        request.query.filtered.filter.bool.must.push(temporal);
    }

    return request;
}

function sendElasticsearchRequest(request, callback, gmap) {
    var xhr, response;

    // Construct and send XMLHttpRequest
    xhr = new XMLHttpRequest();
    xhr.open('POST', ES_URL, true);
    xhr.send(JSON.stringify(request));
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